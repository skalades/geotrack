const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // 1. Create Users
  const passwordHash = await bcrypt.hash('password123', 12)

  const pm = await prisma.user.upsert({
    where: { email: 'pm@geotrack.com' },
    update: {},
    create: {
      name: 'Budi (Project Manager)',
      email: 'pm@geotrack.com',
      passwordHash,
      role: 'super_admin',
    },
  })

  const surveyor1 = await prisma.user.upsert({
    where: { email: 'surveyor1@geotrack.com' },
    update: {},
    create: {
      name: 'Agus (Surveyor)',
      email: 'surveyor1@geotrack.com',
      passwordHash,
      role: 'surveyor',
    },
  })

  const client1 = await prisma.user.upsert({
    where: { email: 'client@geotrack.com' },
    update: {},
    create: {
      name: 'Client Cikelet',
      email: 'client@geotrack.com',
      passwordHash,
      role: 'client',
    },
  })

  console.log('✅ Users created:', { pm: pm.email, surveyor1: surveyor1.email, client1: client1.email })

  // Target Points generation has been removed so it starts empty.
  console.log(`✅ Point generation skipped. Points will be inputted manually.`)

    console.log('📝 Point assignment skipped (no dummy points).')

  console.log('🎉 Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
