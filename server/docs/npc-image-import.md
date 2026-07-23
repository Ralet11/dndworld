# NPC Image Import

## Files

- `server/data/npc-list-prod.json`: snapshot of NPCs currently in production.
- `server/data/npc-image-map.example.json`: editable mapping template from NPC to local image file.
- `server/scripts/import_npc_images.js`: uploads images to Cloudinary and updates `characters.image_url`.

## Expected workflow

1. Copy `server/data/npc-image-map.example.json` to `server/data/npc-image-map.json`.
2. Put the final `.png` images in `server/data/npc-images/`.
3. Make sure each `file` in the JSON matches a real file inside `server/data/npc-images/`.
4. Run a preview:

```bash
cd server
node scripts/import_npc_images.js --dry-run
```

5. If the preview looks good, run the real import:

```bash
cd server
node scripts/import_npc_images.js
```

6. If you need to replace existing NPC portraits, use:

```bash
cd server
node scripts/import_npc_images.js --overwrite
```

## Running on the EC2 database

The safest setup is to run this script on the EC2 host where the production `.env` already points to the live PostgreSQL and Cloudinary credentials.

Example:

```bash
scp -i ~/.ssh/prisma.pem -r server/data/npc-images ubuntu@ec2-3-142-93-72.us-east-2.compute.amazonaws.com:/home/ubuntu/tmp/
scp -i ~/.ssh/prisma.pem server/data/npc-image-map.json ubuntu@ec2-3-142-93-72.us-east-2.compute.amazonaws.com:/home/ubuntu/apps/dndworld/server/data/
scp -i ~/.ssh/prisma.pem server/scripts/import_npc_images.js ubuntu@ec2-3-142-93-72.us-east-2.compute.amazonaws.com:/home/ubuntu/apps/dndworld/server/scripts/
ssh -i ~/.ssh/prisma.pem ubuntu@ec2-3-142-93-72.us-east-2.compute.amazonaws.com
cd /home/ubuntu/apps/dndworld/server
node scripts/import_npc_images.js --images-dir /home/ubuntu/tmp/npc-images --dry-run
node scripts/import_npc_images.js --images-dir /home/ubuntu/tmp/npc-images
```

## Report

The script writes a JSON report to `server/data/npc-image-import-report.json` with success, missing-file, skipped, and error entries.
