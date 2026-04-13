const { createClient } = require('@supabase/supabase-js');

// TODO(Sharon): set these env vars in Netlify site settings → Environment variables.
//   SUPABASE_URL — Supabase project URL
//   SUPABASE_KEY — Supabase service key (or anon if RLS allows upsert into students)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const PRODUCT_SLUG = 'meditation-21';
const PRODUCT_NAME = 'מסע 21 ימי מדיטציה - הרגע היומי';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// PayMe posts callback data as application/x-www-form-urlencoded or JSON.
function parseBody(event) {
    const ct = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    if (!event.body) return {};
    try {
        if (ct.includes('application/json')) {
            return JSON.parse(event.body);
        }
        // urlencoded
        const params = new URLSearchParams(event.body);
        const out = {};
        for (const [k, v] of params.entries()) out[k] = v;
        return out;
    } catch (e) {
        return {};
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const data = parseBody(event);

        // PayMe fields we care about:
        //   payme_sale_id / sale_id — PayMe transaction id
        //   sale_status — "completed" on success
        //   buyer_email / email
        const saleId = data.payme_sale_id || data.sale_id || null;
        const status = (data.sale_status || data.status || '').toLowerCase();
        const buyerEmail = data.buyer_email || data.email || null;
        const buyerName = data.buyer_name || data.name || null;
        const buyerPhone = data.buyer_phone || data.phone || null;

        // Look up the pending purchase either by sale_id or email + product
        let pending = null;
        if (saleId) {
            const { data: rows } = await supabase
                .from('pending_purchases')
                .select('*')
                .eq('sale_id', saleId)
                .eq('product', PRODUCT_SLUG)
                .limit(1);
            if (rows && rows.length) pending = rows[0];
        }
        if (!pending && buyerEmail) {
            const { data: rows } = await supabase
                .from('pending_purchases')
                .select('*')
                .eq('email', buyerEmail)
                .eq('product', PRODUCT_SLUG)
                .limit(1);
            if (rows && rows.length) pending = rows[0];
        }

        const email = buyerEmail || (pending && pending.email) || null;
        const name = buyerName || (pending && pending.name) || null;
        const phone = buyerPhone || (pending && pending.phone) || null;
        const price = (pending && pending.price) || null;

        const isSuccess = status === 'completed' || status === 'success' || status === 'paid';

        if (isSuccess && email) {
            // Mark pending purchase complete
            await supabase
                .from('pending_purchases')
                .update({
                    status: 'completed',
                    sale_id: saleId,
                    completed_at: new Date().toISOString()
                })
                .eq('email', email)
                .eq('product', PRODUCT_SLUG);

            // Insert/upsert into students/entitlements table
            await supabase
                .from('students')
                .upsert({
                    email,
                    name,
                    phone,
                    product: PRODUCT_SLUG,
                    product_name: PRODUCT_NAME,
                    price,
                    sale_id: saleId,
                    purchased_at: new Date().toISOString()
                }, { onConflict: 'email,product' });
        } else if (email) {
            await supabase
                .from('pending_purchases')
                .update({
                    status: status || 'failed',
                    sale_id: saleId
                })
                .eq('email', email)
                .eq('product', PRODUCT_SLUG);
        }

        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
