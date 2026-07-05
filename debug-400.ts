import axios from 'axios'

async function debug() {
  try {
    // 1. Login
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'surveyor1@geotrack.com',
      password: 'password123'
    })
    const token = loginRes.data.data.accessToken
    
    // 2. Post to measurements
    const payload = {
      pointCode: 'GCP-010',
      startTime: '2026-07-03T15:19',
      endTime: '2026-07-03T16:19',
      antennaHeight: 1.732,
      conditionSekitar: 'terbuka',
      weather: 'cerah',
      receiverType: '',
      fieldNotes: ''
    }
    
    console.log('Sending payload:', payload)
    
    const res = await axios.post('http://localhost:3000/api/measurements', payload, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    console.log('Success:', res.data)
  } catch (err: any) {
    console.log('Error status:', err.response?.status)
    console.log('Error data:', err.response?.data)
  }
}

debug()
