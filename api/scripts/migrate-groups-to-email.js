/**
 * Migration script to convert groups from DSP-based to email-based
 * This script will:
 * 1. Backup existing groups data
 * 2. Clear existing groups (DSP-based)
 * 3. Admin needs to manually add email-based groups
 */

import { connectDb, getGroupsCollection, getRegistrationsCollection } from '../db.js';

async function migrateGroupsToEmail() {
  try {
    console.log('Connecting to database...');
    await connectDb();
    
    const groupsCollection = getGroupsCollection();
    const registrationsCollection = getRegistrationsCollection();
    
    // Backup existing groups
    console.log('Backing up existing groups...');
    const existingGroups = await groupsCollection.find().toArray();
    console.log(`Found ${existingGroups.length} existing groups`);
    
    if (existingGroups.length > 0) {
      console.log('Existing groups data:');
      existingGroups.forEach(g => {
        console.log(`  - DSP: ${g.dsp}, Group: ${g.group}, Table: ${g.table}`);
      });
      
      // Clear existing groups
      console.log('Clearing existing groups...');
      await groupsCollection.deleteMany({});
      console.log('Groups cleared');
      
      // Clear group and table from registrations
      console.log('Clearing group and table from registrations...');
      await registrationsCollection.updateMany(
        {},
        { $set: { group: '', table: '' } }
      );
      console.log('Registrations updated');
    } else {
      console.log('No existing groups found, nothing to migrate');
    }
    
    console.log('\nMigration completed successfully!');
    console.log('Please add email-based groups in the admin dashboard.');
    console.log('The groups collection now uses "email" as the key instead of "dsp".');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateGroupsToEmail();
