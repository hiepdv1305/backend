'use strict'
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const uri = process.env.DBURL
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1
})
const db = process.env.DB
const user_table = 'user'
const { response } = require('../init/res')
const bcrypt = require('bcryptjs')
// const { uuid } = require("uuidv4");
const { convertData } = require('../init/convertData')
const aws = require('aws-sdk')
const s3 = new aws.S3()
var md5 = require('md5')
const jwtHelper = require('../init/jwt')
const config = require('../Config/config')
const fields = {
    username: { type: String },
    password: { type: String },
    address: { type: String },
    role: { type: String, default: 'user' },
    balance: { type: Number, default: 0 },
    fullname: { type: String, default: '' },
    phonenumber: { type: String, default: '' },
    email: { type: String, default: '' },
    gendle: { type: Number, default: 1 },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
}
// const rechangeFields = {
//     rechangeId: { type: String, default: crypto.randomBytes(16).toString('hex') },
//     userId: { type: String },
//     bankName: { type: String },
//     amout: { type: Number },
//     status: { type: String, default: 'waiting' },
//     code: { type: String },
//     bankAccount: { type: String },
//     bankAccountNumber: { type: String },
//     createdAt: { type: Date, default: new Date().toISOString() },
//     updatedAt: { type: Date, default: new Date().toISOString() }
// }
// const withdrawalFields = {
//     withdrawalId: { type: String, default: uuid() },
//     userId: { type: String },
//     bankName: { type: String },
//     amout: { type: Number },
//     status: { type: String, default: 'waiting' },
//     bankAccount: { type: String },
//     bankAccountNumber: { type: String },
//     createdAt: { type: Date, default: new Date().toISOString() },
//     updatedAt: { type: Date, default: new Date().toISOString() }
// const RechangeTable = process.env.RECHANGE_TABLE
// const WithdrawalTable = process.env.WITHDRAWAL_TABLE
module.exports.register = async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false
    const user_table_ = client.db(db).collection(user_table)
    let reqBody = JSON.parse(event.body)
    let salt = bcrypt.genSaltSync(10)
    reqBody.password = bcrypt.hashSync(reqBody.password, salt)
    let data = convertData(fields, reqBody)
    let params = {
        username: data.username
    }
    return user_table_
        .findOne(params)
        .then(res => {
            // console.log(res)
            if (res) {
                console.log(1)
                return response('', 'username already exists', 400)
            } else {
                return user_table_.insertOne(data).then(() => {
                    return response('', 'success', 200)
                })
            }
        })
        .catch(err => {
            console.log(err)
            return response('', 'server error', 500)
        })
}

module.exports.login = async (event, context, callback) => {
    const user_table_ = client.db(db).collection(user_table)
    let tokenList = {}
    context.callbackWaitsForEmptyEventLoop = false
    const data = JSON.parse(event.body)
    const params = {
        username: data.username
    }
    return user_table_
        .findOne(params)
        .then(async res => {
            console.log(res)
            if (res && bcrypt.compareSync(data.password, res.password)) {
                const accessToken = await jwtHelper.generateToken(
                    res,
                    config.accessTokenSecret,
                    config.accessTokenLife
                )
                const refreshToken = await jwtHelper.generateToken(
                    res,
                    config.refreshTokenSecret,
                    config.refreshTokenLife
                )
                tokenList[refreshToken] = { accessToken, refreshToken }
                // result.cookie('refreshToken', refreshToken, { secure: false, httpOnly: true, maxAge: config.refreshTokenCookieLife });
                return response(accessToken, 'success', 200)
            } else {
                return response('', 'user or password incorrect', 400)
            }
        })
        .catch(err => {
            return response('', 'user or password incorrect', 400)
        })
}

// module.exports.getNotification = async (event, context, callback) => {
//     let user = context.prev;
//     // console.log(user)
//     let key = 'notification' + user.userId;
//     key = md5(key);
//     let params = {
//         Bucket: `apptmdt`,
//         Key: `notification/${key.slice(0, 2)}/${key.slice(
//             2,
//             4
//         )}/${key.slice(4, 6)}/${key.slice(6)}.json`,
//     };
//     return s3.getObject(params).promise().then(res => {
//         // console.log(res.Body.toString("utf-8"));
//         return response(JSON.parse(res.Body.toString("utf-8")), "success", 200);
//     }).catch(err => {
//         return response(err, "Bạn không có thông báo nào", 500)
//     });

// };

module.exports.update = async (event, context, callback) => {
    let user = context.prev;
    const user_table_ = client.db(db).collection(user_table);
    return user_table_.findOne({
        _id: new ObjectId(user._id)
    })
        .then(res => {
            // console.log(res)
            if (!res) return response('', 'user not exist')
            const item = JSON.parse(event.body)
            item.updatedAt = new Date().toISOString()
            // console.log(item)
            return user_table_
                .updateOne(
                    {
                        _id: new ObjectId(user._id)
                    },
                    { $set: item }
                )
                .then(res => {
                    return response(res, 'success', 200)
                })
                .catch(err => {
                    return response("", err, 500)
                })
        })
};
module.exports.adminUpdate = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        let user = context.prev;
        const id = event.pathParameters.id
        const user_table_ = client.db(db).collection(user_table);
        return user_table_.findOne({
            _id: new ObjectId(id)
        })
            .then(res => {
                if (!res) return response("", "user not exist")
                const item = JSON.parse(event.body);
                item.updatedAt = new Date().toISOString()
                return user_table_.updateOne({ _id: new ObjectId(id) }, { $set: item })
                    .then((res) => {
                        return response(res, "success", 200)
                    })
            })
        // .catch(err => {
        //     return response("", err, 500)
        // })
    }
};

// module.exports.rechange = async (event, context, callback) => {

//     let user = context.prev;

//     let data = JSON.parse(event.body);
//     data.userId = user.userId
//     data = convertData(rechangeFields, data)
//     return db.put({
//         TableName: RechangeTable,
//         Item: data
//     }).promise().then(res => {
//         return response("", "create rechange success", 200)
//     }).catch(err => {
//         return response(err, "rechange unsuccess", 500)
//     })
// };

module.exports.getInfomation = async (event, context, callback) => {
    let user = context.prev;
    const user_table_ = client.db(db).collection(user_table);
    return user_table_.findOne({
        _id: new ObjectId(user._id),
    }).then(res => {
        return response(res, "success", 200)
    }).catch(err => {
        return response(err, "can't get user Infomation")
    })
}

module.exports.adminGetInfomation = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const id = event.pathParameters.id
        const user_table_ = client.db(db).collection(user_table);
        return user_table_.findOne({
            _id: new ObjectId(id),
        }).then(res => {
            return response(res, "success", 200)
        }).catch(err => {
            return response(err, "can't get user Infomation")
        })
    }
};

module.exports.changePassword = async (event, context, callback) => {
    const data = JSON.parse(event.body);
    let user = context.prev;
    const user_table_ = client.db(db).collection(user_table);
    return user_table_.findOne({
        _id: new ObjectId(user._id)
    }).then(res => {
        if (bcrypt.compareSync(data.oldPassword, res.password)) {
            let salt = bcrypt.genSaltSync(10);
            return user_table_.updateOne({ userId: user.userId }, {
                $set: {
                    password: bcrypt.hashSync(data.newPassword, salt)
                }
            }).then(res => {
                return response("", "Thay đổi mật khẩu thành công", 200);
            })
        } else {
            return response("", "Mật khẩu cũ không chính xác", 500)
        }
    }).catch(err => {
        console.log(err)
        return response(err, "can't get user Infomation", 500);

    })
        .then(res => {
            if (bcrypt.compareSync(data.oldPassword, res.password)) {
                let salt = bcrypt.genSaltSync(10)
                return user_table_
                    .updateOne(
                        { _id: new ObjectId(user._id) },
                        {
                            $set: {
                                password: bcrypt.hashSync(data.newPassword, salt)
                            }
                        }
                    )
                    .then(res => {
                        return response('', 'Thay đổi mật khẩu thành công', 200)
                    })
            } else {
                return response('', 'Mật khẩu cũ không chính xác', 500)
            }
        })
        .catch(err => {
            console.log(err)
            return response(err, "can't get user Infomation", 500)
        })
}
module.exports.getAllUser = async (event, context, callback) => {
    let user = context.prev
    // console.log(user)
    const user_table_ = client.db(db).collection(user_table)
    if (user.role == 'admin') {
        return user_table_
            .find({})
            .toArray()
            .then(res => {
                return response(res, 'success', 200)
            })
            .catch(err => {
                return response(err, "can't get user Infomation", 404)
            })
    } else {
        return response('', 'Không đủ quyền thực hiện thao tác', 403)
    }
}

// module.exports.acceptRechange = async (event, context, callback) => {
//     let user = context.prev;
//     if (user.role != 'admin') return response("", "not permistion", 500);
//     const rechangeId = event.pathParameters.id;
//     return db.get({
//         TableName: RechangeTable,
//         Key: {
//             rechangeId: rechangeId,
//         },
//     }).promise().then(res => {
//         if (res.Item.status != 'waiting') return response("", "invalid", 500)
//         let amout = res.Item.amout
//         return db.get({
//             TableName: TableName,
//             Key: {
//                 userId: res.Item.userId,
//             },
//         }).promise().then(res => {
//             return db.update({
//                 TableName: TableName,
//                 Key: {
//                     userId: res.Item.userId,
//                 },
//                 UpdateExpression: 'set #amout = :amout',
//                 ExpressionAttributeNames: {
//                     "#amout": "amout"
//                 },
//                 ExpressionAttributeValues: {
//                     ":amout": res.Item.amout + amout,
//                 },
//             }).promise().then(res => {
//                 return db.update({
//                     TableName: RechangeTable,
//                     Key: {
//                         rechangeId: rechangeId,
//                     },
//                     UpdateExpression: 'set #status = :status',
//                     ExpressionAttributeNames: {
//                         "#status": "status"
//                     },
//                     ExpressionAttributeValues: {
//                         ":status": 'success',
//                     },
//                 }).promise().then(res => {
//                     return response("", "success", 200)
//                 }).catch(err => {
//                     return response(err, "can't update rechange status")
//                 })
//             }).catch(err => {
//                 return response(err, "rechange unsuccess", 500)
//             })
//         }).catch(err => {
//             return response(err, "can't get user", 500)
//         })

//     }).catch(err => {
//         return response(err, "rechange unsuccess", 500)
//     })
// };

// module.exports.getAllRechange = async (event, context, callback) => {
//     let user = context.prev;
//     if (user.role != 'admin') return response("", "not permistion", 500);
//     const params = {
//         TableName: RechangeTable,
//         FilterExpression: '#status = :status',
//         ExpressionAttributeNames: {
//             '#status': 'status',
//         },
//         ExpressionAttributeValues: {
//             ':status': "waiting",
//         },
//     }
//     return db.scan(params)
//         .promise()
//         .then((res) => {
//             return response(res.Items, "success", 200)
//         })
//         .catch((err) => {
//             return response("", err, 500)
//         })
// };

// module.exports.denniRechange = async (event, context, callback) => {
//     let user = context.prev;
//     if (user.role != 'admin') return response("", "not permistion", 500);
//     const rechangeId = event.pathParameters.id;

//     return db.update({
//         TableName: RechangeTable,
//         Key: {
//             rechangeId: rechangeId,
//         },
//         UpdateExpression: 'set #status = :status',
//         ExpressionAttributeNames: {
//             "#status": "status"
//         },
//         ExpressionAttributeValues: {
//             ":status": 'denni',
//         },
//     }).promise().then(res => {
//         return response("", "success", 200)
//     }).catch(err => {
//         return response(err, "can't update rechange status")
//     })

// };

// module.exports.withdrawal = async (event, context, callback) => {

//     let user = context.prev;
//     let data = JSON.parse(event.body);
//     data.userId = user.userId
//     data = convertData(withdrawalFields, data)
//     return db.put({
//         TableName: WithdrawalTable,
//         Item: data
//     }).promise().then(res => {
//         return response("", "create rechange success", 200)
//     }).catch(err => {
//         return response(err, "rechange unsuccess", 500)
//     })
// };

// module.exports.getAllWithdrawal = async (event, context, callback) => {
//     let user = context.prev;
//     if (user.role != 'admin') return response("", "not permistion", 500);
//     const params = {
//         TableName: WithdrawalTable,
//         FilterExpression: '#status = :status',
//         ExpressionAttributeNames: {
//             '#status': 'status',
//         },
//         ExpressionAttributeValues: {
//             ':status': "waiting",
//         },
//     }
//     return db.scan(params)
//         .promise()
//         .then((res) => {
//             return response(res.Items, "success", 200)
//         })
//         .catch((err) => {
//             return response("", err, 500)
//         })
// };

// module.exports.acceptWithdrawal = async (event, context, callback) => {
//     let user = context.prev;
//     if (user.role != 'admin') return response("", "not permistion", 500);
//     const withdrawalId = event.pathParameters.id;
//     return db.get({
//         TableName: WithdrawalTable,
//         Key: {
//             withdrawalId: withdrawalId,
//         },
//     }).promise().then(res => {
//         if (res.Item.status != 'waiting') return response("", "invalid", 500)
//         let amout = res.Item.amout
//         return db.get({
//             TableName: TableName,
//             Key: {
//                 userId: res.Item.userId,
//             },
//         }).promise().then(res => {
//             return db.update({
//                 TableName: TableName,
//                 Key: {
//                     userId: res.Item.userId,
//                 },
//                 UpdateExpression: 'set #amout = :amout',
//                 ExpressionAttributeNames: {
//                     "#amout": "amout"
//                 },
//                 ExpressionAttributeValues: {
//                     ":amout": res.Item.amout - amout,
//                 },
//             }).promise().then(res => {
//                 return db.update({
//                     TableName: WithdrawalTable,
//                     Key: {
//                         withdrawalId: withdrawalId,
//                     },
//                     UpdateExpression: 'set #status = :status',
//                     ExpressionAttributeNames: {
//                         "#status": "status"
//                     },
//                     ExpressionAttributeValues: {
//                         ":status": 'success',
//                     },
//                 }).promise().then(res => {
//                     return response("", "success", 200)
//                 }).catch(err => {
//                     return response(err, "can't update withdrawal status")
//                 })
//             }).catch(err => {
//                 return response(err, "withdrawal unsuccess", 500)
//             })
//         }).catch(err => {
//             return response(err, "can't get user", 500)
//         })

//     }).catch(err => {
//         return response(err, "withdrawal unsuccess", 500)
//     })

// };

// module.exports.denniWithdrawal = async (event, context, callback) => {
//     let user = context.prev;
//     if (user.role != 'admin') return response("", "not permistion", 500);
//     const withdrawalId = event.pathParameters.id;

//     return db.update({
//         TableName: WithdrawalTable,
//         Key: {
//             withdrawalId: withdrawalId,
//         },
//         UpdateExpression: 'set #status = :status',
//         ExpressionAttributeNames: {
//             "#status": "status"
//         },
//         ExpressionAttributeValues: {
//             ":status": 'denni',
//         },
//     }).promise().then(res => {
//         return response("", "success", 200)
//     }).catch(err => {
//         return response(err, "can't update Withdrawal status")
//     })

// };
