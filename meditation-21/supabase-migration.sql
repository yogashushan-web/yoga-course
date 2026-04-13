-- =============================================================================
-- Migration: Multi-product support for Supabase
-- Purpose:   Add a `product` column to students / pending_purchases / discount_codes
--            so the existing course ('precise-beginning') and the new
--            21-day meditation journey ('meditation-21', ₪259) can coexist
--            in the same Supabase project.
--
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query).
-- It is fully idempotent — safe to run multiple times.
--
-- -----------------------------------------------------------------------------
-- CONTEXT (what the current schema does, based on reading the code):
-- -----------------------------------------------------------------------------
--   - `students`            : one row per paying student. Stores email, name,
--                             password, payment_id, payment_status, price_paid,
--                             last_login, login_count, created_at.
--                             No product/course scoping today — a row grants
--                             access to THE course (the "precise-beginning"
--                             yoga course at /course).
--   - `pending_purchases`   : one row per in-flight PayMe sale. Upserted by the
--                             `generate-sale` Netlify function using `email` as
--                             the conflict key. Stores email, price, sale_id,
--                             status ('pending'|'completed'), created_at.
--                             Again, no product column — all rows implicitly
--                             belong to the same single course.
--   - `discount_codes`      : code, discount_percent, max_uses, used_count,
--                             active. Shared pool, not scoped to a product.
--   - `student_devices`     : device fingerprint log per student_email.
--                             Not product-scoped; doesn't need to be.
--   - `leads`               : landing-page email captures with email_stage for
--                             the follow-up drip. Separate table, untouched.
--
--   The course page (/course/index.html) authenticates a student with:
--       SELECT * FROM students WHERE email = $1 AND password = $2
--   The checkout function inserts into pending_purchases keyed by email.
--   The payme-callback function promotes pending -> students on success.
--
-- -----------------------------------------------------------------------------
-- RISKS / THINGS TO WATCH OUT FOR:
-- -----------------------------------------------------------------------------
--   1. DEFAULT 'precise-beginning' is critical. Every existing row must be
--      treated as the yoga course; otherwise the login query
--      `WHERE email=$1 AND password=$2 AND product='precise-beginning'`
--      would return zero rows and lock everyone out.
--
--   2. pending_purchases currently uses `email` as the onConflict target in
--      checkout/netlify/functions/generate-sale.js (upsert .onConflict='email').
--      After this migration, the same email can legitimately have two pending
--      rows (one per product), so:
--        a) we drop any unique constraint on email alone, and
--        b) we add a composite unique index on (email, product).
--      >>> YOU MUST UPDATE generate-sale.js to pass onConflict:'email,product'
--          AND include `product` in the upsert payload, otherwise the upsert
--          will either fail or stomp the wrong row.
--
--   3. students table: in the existing course, login is keyed by (email, password).
--      A buyer of BOTH products will need two student rows (one per product)
--      OR we keep one row and expand access via a join table. This migration
--      takes the simpler path: one students row per (email, product). That
--      means a buyer of both products will receive two welcome emails with
--      two different passwords. Document this in the thankyou flow.
--      >>> UPDATE course/index.html login query to add `.eq('product', 'precise-beginning')`
--      >>> UPDATE meditation-21/course login query to use `.eq('product', 'meditation-21')`
--      >>> UPDATE payme-callback.js "already exists" check to also filter by product.
--
--   4. discount_codes: today a single SHARE20 code works everywhere. If Sharon
--      wants meditation-specific codes (e.g. MEDIT50 only valid for the
--      ₪259 product), we add an optional `product` column that, when NULL,
--      means "valid for any product" (back-compat), and when set, scopes the
--      code. Checkout logic must then filter `code=$1 AND active AND
--      (product IS NULL OR product=$currentProduct)`.
--
--   5. RLS: if Row Level Security policies exist on these tables (not visible
--      in the codebase — they'd be set in the Supabase Dashboard), they may
--      need updating to reference the new column. Review policies after
--      running this migration.
--
--   6. Indexes: the (email, product) index on students speeds up login.
--      Without it, login latency on a growing table becomes noticeable.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. students: add product column
-- -----------------------------------------------------------------------------
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'precise-beginning';

-- Backfill safety: any pre-existing row that somehow has NULL becomes
-- precise-beginning. (Redundant with the DEFAULT + NOT NULL above, but
-- harmless and explicit.)
UPDATE students SET product = 'precise-beginning' WHERE product IS NULL;

-- Drop the unique-on-email constraint if it exists, because the same email
-- can now appear twice (once per product). The constraint name varies by how
-- the table was first created; we try the common ones.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_email_key') THEN
        ALTER TABLE students DROP CONSTRAINT students_email_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_email_unique') THEN
        ALTER TABLE students DROP CONSTRAINT students_email_unique;
    END IF;
END $$;

-- Composite uniqueness: one row per (email, product).
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_product_unique
    ON students (lower(email), product);

-- Fast lookup for the login query.
CREATE INDEX IF NOT EXISTS idx_students_email_product
    ON students (email, product);


-- -----------------------------------------------------------------------------
-- 2. pending_purchases: add product column
-- -----------------------------------------------------------------------------
ALTER TABLE pending_purchases
    ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'precise-beginning';

UPDATE pending_purchases SET product = 'precise-beginning' WHERE product IS NULL;

-- Remove old unique-on-email constraint if present (the upsert onConflict target).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_purchases_email_key') THEN
        ALTER TABLE pending_purchases DROP CONSTRAINT pending_purchases_email_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_purchases_email_unique') THEN
        ALTER TABLE pending_purchases DROP CONSTRAINT pending_purchases_email_unique;
    END IF;
END $$;

-- Composite uniqueness: a user can have one in-flight purchase per product.
-- This is the new onConflict target for the generate-sale upsert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_purchases_email_product_unique
    ON pending_purchases (email, product);

-- Index used by the payme-callback lookup and by the "recent pending" fallback.
CREATE INDEX IF NOT EXISTS idx_pending_purchases_sale_id
    ON pending_purchases (sale_id);

CREATE INDEX IF NOT EXISTS idx_pending_purchases_status_created
    ON pending_purchases (status, created_at DESC);


-- -----------------------------------------------------------------------------
-- 3. discount_codes: optional product scoping
--    NULL = valid for any product (preserves backward compatibility for
--    SHARE20 and any other existing codes).
-- -----------------------------------------------------------------------------
ALTER TABLE discount_codes
    ADD COLUMN IF NOT EXISTS product TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_discount_codes_code_product
    ON discount_codes (code, product);


-- =============================================================================
-- ACCESS-CHECK EXAMPLES
-- (These are NOT executed — they document how the app code should query.)
-- =============================================================================

/*
-- ---- A. Course page authentication ----

-- Existing yoga course (course/index.html) — UPDATE the query to include product:
SELECT *
FROM students
WHERE email    = $1
  AND password = $2
  AND product  = 'precise-beginning'
LIMIT 1;

-- New meditation course (meditation-21/course) — same shape, different product:
SELECT *
FROM students
WHERE email    = $1
  AND password = $2
  AND product  = 'meditation-21'
LIMIT 1;


-- ---- B. Checkout: create / upsert the pending purchase ----

-- In meditation-21/checkout/netlify/functions/generate-sale.js:
--   supabase.from('pending_purchases').upsert({
--       email, price: 259, status: 'pending',
--       product: 'meditation-21',
--       created_at: new Date().toISOString()
--   }, { onConflict: 'email,product' });
--
-- Equivalent raw SQL:
INSERT INTO pending_purchases (email, price, status, product, created_at)
VALUES ($1, 259, 'pending', 'meditation-21', now())
ON CONFLICT (email, product)
DO UPDATE SET price      = EXCLUDED.price,
              status     = EXCLUDED.status,
              created_at = EXCLUDED.created_at;

-- Attach the PayMe sale_id once we have it back:
UPDATE pending_purchases
SET    sale_id = $1
WHERE  email = $2 AND product = 'meditation-21';


-- ---- C. Webhook: promote pending -> students ----

-- Step 1: look up the pending purchase by sale_id (unchanged).
SELECT email, price, product
FROM   pending_purchases
WHERE  sale_id = $1
LIMIT  1;

-- Step 2: check if the student ALREADY has access to THIS product.
SELECT 1
FROM   students
WHERE  email = $1
  AND  product = $2
LIMIT  1;

-- Step 3a: if no existing row, create one scoped to this product.
INSERT INTO students
    (email, name, password, payment_id, payment_status, price_paid, product)
VALUES
    ($1,    $2,   $3,       $4,         'completed',    $5,         $6)
RETURNING *;

-- Step 3b: mark the pending row completed (scoped by product).
UPDATE pending_purchases
SET    status = 'completed'
WHERE  email = $1 AND product = $2;


-- ---- D. Discount code lookup (product-aware) ----

-- Use this shape in both checkout pages so a code can be either global
-- (product IS NULL) or scoped to one product:
SELECT *
FROM   discount_codes
WHERE  code   = $1
  AND  active = TRUE
  AND  (product IS NULL OR product = $2)   -- $2 = current cart product
  AND  used_count < max_uses
LIMIT  1;
*/


-- =============================================================================
-- VERIFICATION QUERIES (run manually after the migration)
-- =============================================================================

/*
-- Every existing student should be 'precise-beginning':
SELECT product, COUNT(*) FROM students GROUP BY product;

-- Every existing pending purchase should also be 'precise-beginning':
SELECT product, COUNT(*) FROM pending_purchases GROUP BY product;

-- Confirm the new unique indexes exist:
SELECT indexname FROM pg_indexes
WHERE tablename IN ('students', 'pending_purchases', 'discount_codes')
ORDER BY tablename, indexname;
*/
