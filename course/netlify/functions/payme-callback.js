const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tyjlyfyqwgihbhhxbeqe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5amx5Znlxd2dpaGJoaHhiZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDY2NDMsImV4cCI6MjA4Njg4MjY0M30.SA9hudQQdroQhdQAg6aYICNmhg8aSavE3qZ5YhTmCE0';

const EMAILJS_SERVICE_ID = 'yoga_service';
const EMAILJS_TEMPLATE_ID = 'template_o3kxtq3';
const EMAILJS_PUBLIC_KEY = 'e68o52Ief_mCyAZIa';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function sendEmail(name, email, password) {
    const emailData = {
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
            name: name,
            email: email,
            password: password,
            course_url: 'https://coursepageyogac.netlify.app',
            whatsapp_url: 'https://chat.whatsapp.com/BiN8sg5oTjo4DAjNCAMMaI'
        }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send email: ${response.status} ${errorText}`);
    }

    return response.text();
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
        console.log('Received callback from PayMe');
        console.log('Raw body:', event.body);

        const params = new URLSearchParams(event.body);
        const paymentStatus = params.get('payme_status');
        const paymentId = params.get('payme_sale_id');

        // Try to get email from PayMe callback first
        let buyerEmail = params.get('buyer_email') || params.get('sale_buyer_email') || '';
        let buyerName = params.get('buyer_name') || params.get('sale_buyer_name') || '';
        let pricePaid = null;

        console.log('Payment status:', paymentStatus);
        console.log('Payment ID:', paymentId);
        console.log('Buyer email from PayMe:', buyerEmail);

        if (paymentStatus !== 'completed' && paymentStatus !== 'success') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Payment not successful', status: paymentStatus })
            };
        }

        // If PayMe didn't return the email, look it up in pending_purchases
        if (!buyerEmail && paymentId) {
            console.log('Email not in callback, looking up pending purchase by sale_id:', paymentId);
            const { data: pending } = await supabase
                .from('pending_purchases')
                .select('*')
                .eq('sale_id', paymentId)
                .single();

            if (pending) {
                buyerEmail = pending.email;
                pricePaid = pending.price;
                console.log('Found email from pending purchase:', buyerEmail, 'price:', pricePaid);
            }
        }

        // Fallback: find the most recent pending purchase (within last 30 minutes)
        if (!buyerEmail) {
            console.log('Trying fallback: most recent pending purchase');
            const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            const { data: recentPending } = await supabase
                .from('pending_purchases')
                .select('*')
                .eq('status', 'pending')
                .gte('created_at', thirtyMinAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (recentPending) {
                buyerEmail = recentPending.email;
                pricePaid = recentPending.price;
                console.log('Found email from recent pending:', buyerEmail, 'price:', pricePaid);
            }
        }

        if (!buyerEmail) {
            console.error('Could not determine buyer email');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Payment successful but no email found', paymentId })
            };
        }

        if (!buyerName) buyerName = 'תלמידה';

        // Check if student already exists
        const { data: existing } = await supabase
            .from('students')
            .select('*')
            .eq('email', buyerEmail)
            .single();

        if (existing) {
            console.log('Student already exists:', buyerEmail);
            // Mark pending purchase as completed
            await supabase
                .from('pending_purchases')
                .update({ status: 'completed' })
                .eq('email', buyerEmail);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Student already exists' })
            };
        }

        // Create student with generated password
        const password = generatePassword();

        const { data: student, error: insertError } = await supabase
            .from('students')
            .insert([{
                email: buyerEmail,
                name: buyerName,
                password: password,
                payment_id: paymentId,
                payment_status: 'completed',
                price_paid: pricePaid || 550
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Error inserting student:', insertError);
            throw insertError;
        }

        console.log('Student created:', student.email);

        // Send welcome email with credentials
        try {
            await sendEmail(buyerName, buyerEmail, password);
            console.log('Welcome email sent successfully to:', buyerEmail);
        } catch (emailError) {
            console.error('Error sending email:', emailError);
            // Log the failure but don't fail the callback
        }

        // Mark pending purchase as completed
        await supabase
            .from('pending_purchases')
            .update({ status: 'completed' })
            .eq('email', buyerEmail);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Student created and email sent',
                email: buyerEmail
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
