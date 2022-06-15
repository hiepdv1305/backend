module.exports.response = (data,message ,statusCode) => {
    return {
      headers: {
        "Access-Control-Allow-Origin": process.env.origin,
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: message,
        statusCode:statusCode,
        data
      }),
    };
  }