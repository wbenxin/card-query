const log4js = require('log4js');
const mysql = require('mysql2');

const s_pool = Symbol('pool');
const s_execute = Symbol('execute');

const logger = log4js.getLogger();

class Mysql {
  constructor(pool) {
    this.driver = 'mysql';
    this[s_pool] = pool;
  }

  async getConnection() {
    return await this[s_pool].getConnection();
  }

  async [s_execute](conn, sql, values = []) {
    const begin = process.hrtime();
    const raw_result = await conn.execute(sql, values);
    const span = process.hrtime(begin);
    const result = this.format_result(raw_result);
    logger.debug(`SQL: ${sql} → ${JSON.stringify(values)} >> ${JSON.stringify(result)} ${span}`);
    return result;
  }

  async execute(sql, values = []) {
    const conn = await this[s_pool].getConnection();
    try {
      return await this[s_execute](conn, sql, values);
    } catch (e) {
      logger.error(`SQL: ${sql} → ${JSON.stringify(values)} >> ${e.message}`);
      throw e;
    } finally {
      conn.release();
    }
  }

  /**
   * 事务执行
   * @param {(execute:(sql,values)=>Promise<{rows, fields}>)} callback 在事务中执行的回调函数
   */
  async trans(callback) {
    logger.debug(`start transaction`);
    const conn = await this[s_pool].getConnection();
    await conn.beginTransaction();
    try {
      await callback(async (sql, values = []) => {
        try {
          return await this[s_execute](conn, sql, values);
        } catch (e) {
          logger.error(`SQL: ${sql} → ${JSON.stringify(values)} >> ${e.message}`);
          throw e;
        }
      });
      await conn.commit();
      logger.debug(`commit transaction`);
    } catch (e) {
      await conn.rollback();
      logger.debug(`rollback transaction`);
      return e;
    } finally {
      conn.release();
    }
  }

  /**
   * 格式化sql执行结果
   * @param {object}} result 
   */
  format_result(result) {
    if (result[0] instanceof Array) {
      return {
        rows: result[0],
        fields: result[1],
      };
    } else {
      return {
        affected: result[0].affectedRows,
        insertId: result[0].insertId,
      };
    }
  }
}

module.exports = async function (config) {
  const pool = mysql.createPool(config).promise();
  return new Mysql(pool);
};