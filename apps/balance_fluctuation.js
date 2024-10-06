'use strict'
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const uri = process.env.DBURL
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1
})
const db = process.env.DB
const balance_fluctuation_table = 'balance_fluctuation'
const user_table = 'user'
const { response } = require('../init/res')

const fields = {
  userId: { type: String },
  amount: { type: Number },
  balance: { type: Number },
  description: { type: String },
  createdAt: { type: Date, default: new Date().toISOString() }
}

module.exports.create_balance_fluctuation = async (
  amount,
  description,
  userId
) => {
  const balance_fluctuation_table_ = client
    .db(db)
    .collection(balance_fluctuation_table)
  const user_table_ = client.db(db).collection(user_table)
  let user_data = await user_table_.findOne({ _id: new ObjectId(userId) })
  // console.log(user_data)
  if (user_data.balance < -amount) return 2
  user_data.balance += amount
  return user_table_
    .updateOne(
      { _id: new ObjectId(userId) },
      { $set: { balance: user_data.balance } }
    )
    .then(res => {
      return balance_fluctuation_table_
        .insertOne({
          userId: userId,
          amount: amount,
          balance: user_data.balance,
          description: description,
          createdAt: new Date().toISOString()
        })
        .then(res => {
          return 1
        })
    })
    .catch(err => {
      return 0
    })
}

module.exports.getBalanceFluctuation = async (event, context, callback) => {
  let user = context.prev

  const id = event.pathParameters.id
  const balance_fluctuation_table_ = client
    .db(db)
    .collection(balance_fluctuation_table)
  balance_fluctuation_table_.findOne({ _id: new ObjectId(id) }).then(res => {
    if (user.role != 'admin' && user._id != res.userId)
      return response('', 'no permision', 500)
    return response(res, 'success', 200)
  })
}

module.exports.getAllBalanceFluctuation = async (event, context, callback) => {
  let user = context.prev
  const balance_fluctuation_table_ = client
    .db(db)
    .collection(balance_fluctuation_table)
  if (user.role != 'admin') {
    return balance_fluctuation_table_
      .find({ userId: user._id })
      .toArray()
      .then(res => {
        return response(res, 'success', 200)
      })
  } else {
    return balance_fluctuation_table_
      .find({})
      .toArray()
      .then(res => {
        return response(res, 'success', 200)
      })
  }
}
