import { connectDb, getRestaurantCollection } from '../db.js';
import { readJson } from '../utils.js';

async function migrateRestaurant() {
  try {
    await connectDb();
    const collection = getRestaurantCollection();
    
    // Check if restaurant data already exists in MongoDB
    const existing = await collection.findOne({});
    if (existing) {
      console.log('Restaurant data already exists in MongoDB. Skipping migration.');
      return;
    }
    
    // Read from JSON file
    const jsonData = await readJson('restaurant.json');
    console.log('Restaurant data from JSON:', jsonData);
    
    // Insert into MongoDB
    const restaurantData = {
      name: jsonData.name || '',
      location: jsonData.location || '',
      timing: jsonData.timing || '',
      qrFile: jsonData.qrFile || '',
      qrName: jsonData.qrName || ''
    };
    
    await collection.insertOne(restaurantData);
    console.log('Restaurant data migrated to MongoDB successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateRestaurant().then(() => {
  console.log('Migration completed');
  process.exit(0);
});