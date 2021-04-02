const db = new Map();

/**
 * 配置连接信息
 * @param {{name: {}}} config 
 */
exports.configure = (config) => {
  const keys = Object.keys(config);
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let item = config[key];
    // 识别数据库类型
    if (item.driver === 'oracle' || item.connectString) {
      const Oracle = require('./db-oracle');
      db.set(key, new Oracle(item));
    }
    if (item.driver === 'mysql' || item.host) {
      const Mysql = require('./db-mysql');
      db.set(key, new Mysql(item));
    }
  }
};

/**
 * 获取数据库连接
 * @param {string} name - 数据库连接名称
 */
exports.getDatabase = (name) => {
  name = name || 'default';
  return db.get(name);
};
