console.log('Step 1: Testing imports...');
try {
    console.log('Step 2: Importing schema...');
    const { rules } = await import('../schema.ts');
    console.log('Schema imported successfully');
    
    console.log('Step 3: Importing drizzle...');
    const { drizzle } = await import('drizzle-orm/vercel-postgres');
    console.log('Drizzle imported successfully');
    
    console.log('Step 4: Importing createPool...');
    const { createPool } = await import('@vercel/postgres');
    console.log('createPool imported successfully');
    
    console.log('Step 5: Creating pool...');
    const pool = createPool({
        connectionString: process.env.POSTGRES_URL
    });
    console.log('Pool created successfully');
    console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
    
    console.log('All imports successful!');
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
