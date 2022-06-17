'use strict';
const { response } = require("../init/res");
const db = require('../init/db');
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const fields = {
    productId: { type: String, default: uuid() },
    productName: { type: String },
    description: { type: String, default: '' },
    category: { type: String },
    image: { type: String },
    status: { type: String, default: 'active' },
    price: { type: Number },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
// const axios = require("axios");
const TableName = process.env.PRODUCT_TABLE;

module.exports.create = async (event, context, callback) => {
    // let user = context.jwtDecoded;
    let user = context.prev;
    // console.log(user.role)
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        let reqBody = JSON.parse(event.body);
        let data = convertData(fields, reqBody);
        // console.log(data)
        return db.put(
            {
                TableName: TableName,
                Item: data,
            }
        ).promise()
            .then((res) => {
                console.log(res)
                return response(res, "succces", 200);
            })
            .catch((err) => {
                return response("", "server error", 400)
            })

    }

};

module.exports.get = async (event, context, callback) => {
    const id = event.pathParameters.id;
    return db.scan(
        {
            TableName: TableName,
            FilterExpression: '#productId = :productId',
            ExpressionAttributeNames: {
                '#productId': 'productId',
            },
            ExpressionAttributeValues: {
                ':productId': id,
            },
        }
    ).promise()
        .then((res) => {
            if (res.Count == 0) return response("", "product not exist", 400)
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", err, 500)
        })
};

module.exports.delete = async (event, context, callback) => {
    // let user = context.jwtDecoded;
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const id = event.pathParameters.id
        const params = {
            TableName: TableName,
            Key: {
                productId: id,
            },
            UpdateExpression: 'set #status = :status',
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":status": "delete",
            },
        }
        return db.update(params)
            .promise()
            .then((res) => {
                return response(res, "success", 200)
            })
    }

};

module.exports.getAll = async (event, context, callback) => {
    const params = {
        TableName: TableName,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
        ExpressionAttributeValues: {
            ':status': "active",
        },
    }
    return db.scan(params)
        .promise()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", err, 500)
        })
};

module.exports.update = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const id = event.pathParameters.id;
        return db.scan({
            TableName: TableName,
            FilterExpression: '#productId = :productId',
            ExpressionAttributeNames: {
                '#productId': 'productId',
            },
            ExpressionAttributeValues: {
                ':productId': id,
            },
        }).promise()
            .then(res => {
                if (res.Count == 0) return response("", "product not exist")
                const item = JSON.parse(event.body);
                let updateExpression = 'set';
                let ExpressionAttributeNames = {};
                let ExpressionAttributeValues = {};
                for (const property in item) {
                    updateExpression += ` #${property} = :${property} ,`;
                    ExpressionAttributeNames['#' + property] = property;
                    ExpressionAttributeValues[':' + property] = item[property];
                }
                updateExpression = updateExpression.slice(0, -1);
                const params = {
                    TableName: TableName,
                    Key: {
                        productId: id,
                    },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeNames: ExpressionAttributeNames,
                    ExpressionAttributeValues: ExpressionAttributeValues
                };
                return db.update(params).promise()
                    .then((res) => {
                        return response(res, "success", 200)
                    })
            })
            .catch(err => {
                return response("", err, 500)
            })

    }

};