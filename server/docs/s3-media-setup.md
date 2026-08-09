# DnD World: almacenamiento S3

Bucket previsto: `prismadevs-dndworld-media-us-east-2`, región `us-east-2`.

La aplicación guarda imágenes, mapas, renders y audio en un único bucket, separados por prefijo de entorno y carpeta:

```text
development/images/
development/audio/
development/renders/
development/items/
development/npcs/
production/images/
production/audio/
production/renders/
production/items/
production/npcs/
```

## Variables

En producción:

```dotenv
AWS_REGION=us-east-2
S3_BUCKET=prismadevs-dndworld-media-us-east-2
S3_PREFIX=production
S3_PUBLIC_BASE_URL=https://dndworld.prismadevs.com/api/media
```

El EC2 debe usar un IAM Instance Profile; no deben copiarse access keys al servidor. El role necesita `s3:PutObject`, `s3:GetObject` y `s3:DeleteObject` sobre `arn:aws:s3:::prismadevs-dndworld-media-us-east-2/production/*`.

El bucket permanece privado. DnD World entrega los objetos mediante `/api/media/*`, usando el IAM Role del EC2 y soportando solicitudes HTTP Range para audio. No es necesario desactivar Block Public Access ni agregar una bucket policy pública. CloudFront puede incorporarse más adelante cambiando únicamente `S3_PUBLIC_BASE_URL`.

Para desarrollo local puede usarse un perfil de AWS o credenciales de un usuario limitado al prefijo `development/*`.

La API acepta imágenes JPG, PNG, WEBP y GIF de hasta 20 MB. El audio acepta MP3, OGG, WAV, M4A, AAC y FLAC de hasta 120 MB.
