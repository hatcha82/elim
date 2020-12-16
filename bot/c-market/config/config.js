// const path = require('path')
module.exports = {
  port: process.env.PORT || 8081,
  db: {
    database: '',
    user: '',
    password: '',
    options: {
      dialect: 'mysql',
      host: '',
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      logging: true
    }
  },
  authentication: {
    jwtSecret: process.env.JWT_SECRET || 'secret'
  },
  email:{
    user :'',
    pass : ''
  },
  cMarket :{
    host: '',
    user:'',
    pass:''
  },
  sendTarget : {
    email : ['']
  }
}