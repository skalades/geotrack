import axios from 'axios'

async function debug() {
  try {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'surveyor1@geotrack.com',
      password: 'password123'
    })
    const token = loginRes.data.data.accessToken
    
    console.log('Sending submit payload...')
    
    const payload = {
      photoNorthUrl: '/uploads/photos/fake1.jpg',
      photoSouthUrl: '/uploads/photos/fake2.jpg',
      photoEastUrl: '/uploads/photos/fake3.jpg',
      photoWestUrl: '/uploads/photos/fake4.jpg',
      rinexFileUrl: '/uploads/rinex/fake.zip'
    }
    
    // Hardcode measurement ID 10 based on the previous debug log output which created/updated ID 10
    const res = await axios.post('http://localhost:3000/api/measurements/10/submit', payload, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    console.log('Success:', res.data)
  } catch (err: any) {
    console.log('Error status:', err.response?.status)
    console.log('Error data:', err.response?.data)
  }
}

debug()
