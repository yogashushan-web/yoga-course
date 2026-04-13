const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const PAYME_API_KEY = 'MPL17172-30698Y8A-DZIV0NFT-INFT0OPW';
const CALLBACK_URL = 'https://coursepageyogac.netlify.app/.netlify/functions/payme-callback';
const SUCCESS_URL = 'https://yogashushan.com/thankyou';

const SUPABASE_URL = 'https://tyjlyfyqwgihbhhxbeqe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5amx5Znlxd2dpaGJoaHhiZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDY2NDMsImV4cCI6MjA4Njg4MjY0M30.SA9hudQQdroQhdQAg6aYICNmhg8aSavE3qZ5YhTmCE0';

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
        const priceInAgorot = (body.price || 550) * 100;
        const buyerEmail = body.email || '';

        // Build return URL with email parameter
        const successUrl = buyerEmail
            ? `${SUCCESS_URL}?buyer_email=${encodeURIComponent(buyerEmail)}`
            : SUCCESS_URL;

        // Save pending purchase to Supabase so the callback can find the email
        if (buyerEmail) {
            await supabase
                .from('pending_purchases')
                .upsert({
                    email: buyerEmail,
                    price: body.price || 550,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }, { onConflict: 'email' });
        }

        const saleData = {
            seller_payme_id: PAYME_API_KEY,
            sale_price: priceInAgorot,
            currency: 'ILS',
            sale_description: 'קורס התחלה מדויקת',
            product_name: 'קורס התחלה מדויקת',
            sale_callback_url: CALLBACK_URL,
            sale_return_url: successUrl,
            sale_send_notification: true,
            language: 'he',
            buyer_email: buyerEmail
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
                    catch(e) { resolve({ raw: data }); }
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        // Save the sale_id from PayMe linked to the email
        const saleId = result.payme_sale_id || result.sale_id;
        if (buyerEmail && saleId) {
            await supabase
                .from('pending_purchases')
                .update({ sale_id: saleId })
                .eq('email', buyerEmail);
        }

        return { statusCode: 200, headers, body: JSON.stringify(result) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
