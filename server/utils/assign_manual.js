const { User, Character } = require('../models');

// Obtener argumentos de la línea de comandos
const email = process.argv[2];
const charName = process.argv[3];

if (!email || !charName) {
    console.log('\n❌  Error: Faltan argumentos.');
    console.log('👉  Uso correcto: node utils/assign_manual.js "email@usuario.com" "Nombre Del Personaje"');
    console.log('    Ejemplo: node utils/assign_manual.js "player@dndworld.com" "Paleas Mucron"\n');
    process.exit(1);
}

const assignCharacter = async () => {
    try {
        console.log(`\n🔍  Buscando usuario: ${email}...`);
        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.error(`❌  Usuario con email "${email}" no encontrado.`);
            return;
        }
        console.log(`✅  Usuario encontrado: ${user.username} (ID: ${user.id})`);

        console.log(`🔍  Buscando personaje: ${charName}...`);
        const char = await Character.findOne({ where: { name: charName } });
        if (!char) {
            console.error(`❌  Personaje "${charName}" no encontrado.`);
            return;
        }
        console.log(`✅  Personaje encontrado: ${char.name} (ID: ${char.id})`);

        // Asignar
        char.UserId = user.id;
        await char.save();

        console.log(`\n🎉  ¡ÉXITO!`);
        console.log(`    ${char.name} ha sido asignado correctamente a ${user.email}.\n`);

    } catch (error) {
        console.error('\n❌  Ocurrió un error:', error);
    }
};

assignCharacter();
