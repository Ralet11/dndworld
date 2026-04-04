const { Client } = require('pg');
require('dotenv').config();

const createDb = async () => {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        password: process.env.DB_PASS,
        port: 5432,
        database: 'postgres' // Connect to default postgres db to create the new one
    });

    try {
        await client.connect();
        await client.query('CREATE DATABASE dndworld');
        console.log('Database dndworld created successfully.');
    } catch (err) {
        if (err.code === '42P04') {
            console.log('Database dndworld already exists.');
        } else {
            console.error('Error creating database:', err);
        }
    } finally {
        await client.end();
    }
};

createDb();
