const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// TODO(Sharon): set these env vars in Netlify site settings → Environment variables.
//   PAYME_API_KEY      — PayMe seller API key (MPL...)
//   SUPABASE_URL       — Supabase project URL
//   SUPABASE_KEY       — Supabase anon key
//   CHECKOUT_SITE_URL  — the deployed checkout site URL, e.g. https://meditation-21-checkout.netlify.app
//   SUCCESS_URL        — thank-you page URL after successful payment (placeholder: https://21days-thankyou.netlify.app)
const PAYME_API_KEY = process.env.PAYME_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CHECKOUT_SITE_URL = process.env.CHECKOUT_SITE_URL || 'https://meditation-21-checkout.netlify.app';
// PLACEHOLDER — replace via env var once the thank-you site is deployed.
const SUCCESS_URL = process.env.SUCCESS_URL || 'https://21days-thankyou.netlify.app';
const CALLBACK_URL = `${CHECKOUT_SITE_URL}/.netlify/functions/payme-callback`;

const PRODUCT_SLUG = 'meditation-21';
const PRODUCT_NAME = 'מסע 21 ימי מדיטציה - הרגע היומי';
const DEFAULT_PRICE = 259;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
        const body = JSON.parse(event.body || '{}');
        const price = body.price || DEFAULT_PRICE;
        const priceInAgorot = price * 100;
        const buyerEmail = body.email || '';
        const buyerName = body.name || '';
        const buyerPhone = body.phone || '';

        // Build return URL with email + product parameters
        const params = new URLSearchParams();
        if (buyerEmail) params.set('buyer_email', buyerEmail);
        params.set('product', PRODUCT_SLUG);
        const successUrl = `${SUCCESS_URL}?${params.toString()}`;

        // Save pending purchase to Supabase so the callback can find the buyer
        if (buyerEmail) {
            await supabase
                .from('pending_purchases')
                .upsert({
                    email: buyerEmail,
                    name: buyerName,
                    phone: buyerPhone,
                    product: PRODUCT_SLUG,
                    price: price,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }, { onConflict: 'email,product' });
        }

        const saleData = {
            seller_payme_id: PAYME_API_KEY,
            sale_price: priceInAgorot,
            currency: 'ILS',
            sale_description: PRODUCT_NAME,
            product_name: PRODUCT_NAME,
            sale_callback_url: CALLBACK_URL,
            sale_return_url: successUrl,
            sale_send_notification: true,
            language: 'he',
            buyer_email: buyerEmail,
            buyer_name: buyerName,
            buyer_phone: buyerPhone
        };

        const postData = JSON.stringify(saleData);

        const result = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'live.payme.io',
                path: '/api/generate-sale',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { resolve({ raw: data }); }
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        // Save the sale_id from PayMe linked to the email + product
        const saleId = result.payme_sale_id || result.sale_id;
        if (buyerEmail && saleId) {
            await supabase
                .from('pending_purchases')
                .update({ sale_id: saleId })
                .eq('email', buyerEmail)
                .eq('product', PRODUCT_SLUG);
        }

        return { statusCode: 200, headers, body: JSON.stringify(result) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
