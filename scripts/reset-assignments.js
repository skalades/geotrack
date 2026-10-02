const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Menghapus semua penugasan (measurements)...')
  const result = await prisma.measurement.deleteMany()
  console.log(`Berhasil mereset ${result.count} titik menjadi unassigned (belum di-assign).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
