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
        throw new Error('Failed to send email');
    }

    return response.json();
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
        
        const params = new URLSearchParams(event.body);
        const paymentStatus = params.get('payme_status');
        const buyerEmail = params.get('buyer_email');
        const buyerName = params.get('buyer_name') || 'תלמידה';
        const paymentId = params.get('payme_sale_id');

        console.log('Payment status:', paymentStatus);
        console.log('Buyer email:', buyerEmail);

        if (paymentStatus !== 'completed' && paymentStatus !== 'success') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Payment not successful' })
            };
        }

        const { data: existing } = await supabase
            .from('students')
            .select('*')
            .eq('email', buyerEmail)
            .single();

        if (existing) {
            console.log('Student already exists');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Student already exists' })
            };
        }

        const password = generatePassword();
        
        const { data: student, error: insertError } = await supabase
            .from('students')
            .insert([{
                email: buyerEmail,
                name: buyerName,
                password: password,
                payment_id: paymentId,
                payment_status: 'completed'
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Error inserting student:', insertError);
            throw insertError;
        }

        console.log('Student created:', student.email);

        try {
            await sendEmail(buyerName, buyerEmail, password);
            console.log('Email sent successfully');
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                message: 'Student created successfully',
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
