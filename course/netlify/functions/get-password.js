const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tyjlyfyqwgihbhhxbeqe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5amx5Znlxd2dpaGJoaHhiZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDY2NDMsImV4cCI6MjA4Njg4MjY0M30.SA9hudQQdroQhdQAg6aYICNmhg8aSavE3qZ5YhTmCE0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const email = params.email;

        if (!email) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email required' })
            };
        }

        // Get student by email
        const { data: student, error } = await supabase
            .from('students')
            .select('password, name')
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !student) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Student not found' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                password: student.password,
                name: student.name || 'תלמידה'
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
