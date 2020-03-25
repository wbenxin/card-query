/**
 * 数据库访问接口
 */
const mysql = require('./db-mysql');
const oracle = require('./db-oracle');

const db = new Map();

/**
 * 配置连接信息
 * @param {{name: {}}} config 
 */
exports.configure = async function (config) {
  const keys = Object.keys(config);
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let item = config[key];
    // 识别数据库类型
    if (item.driver === 'oracle' || item.connectString) {
      db.set(key, await oracle(item));
    }
    if (item.driver === 'mysql' || item.host) {
      db.set(key, await mysql(item));
    }
  }
};

/**
 * 获取数据库连接
 * @param {string} name - 数据库连接名称
 */
exports.getDatabase = function (name) {
  name = name || 'default';
  return db.get(name);
};