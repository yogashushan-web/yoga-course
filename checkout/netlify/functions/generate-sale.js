const https = require('https');

const PAYME_API_KEY = 'MPL17172-30698Y8A-DZIV0NFT-INFT0OPW';
const CALLBACK_URL = 'https://coursepageyogac.netlify.app/.netlify/functions/payme-callback';
const SUCCESS_URL = 'https://thankyouyogac.netlify.app';

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

        const saleData = {
            seller_payme_id: PAYME_API_KEY,
            sale_price: priceInAgorot,
            currency: 'ILS',
            sale_description: 'קורס התחלה מדויקת',
            product_name: 'קורס התחלה מדויקת',
            sale_callback_url: CALLBACK_URL,
            sale_return_url: successUrl,
            sale_send_notification: true,
            language: 'he'
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

        return { statusCode: 200, headers, body: JSON.stringify(result) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
