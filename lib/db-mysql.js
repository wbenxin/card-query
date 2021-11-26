const log4js = require('@log4js-node/log4js-api');
const mysql = require('mysql2');
const _ = require('lodash');

const s_pool = Symbol('pool');
const s_execute = Symbol('execute');

const logger = log4js.getLogger();

module.exports = class Mysql {
  constructor(config) {
    Object.defineProperty(this, 'driver', {
      configurable: false,
      writable: false,
      enumerable: false,
      value: 'mysql',
    });

    this[s_pool] = mysql.createPool(_.omit(config, ['driver'])).promise();
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
      throw e;
    } finally {
      conn.release();
    }
  }

  /**
   * 格式化sql执行结果
   * @param {object}} result 
   */
  format_result(result) {
    const [results, fields] = result;
    if (results instanceof Array) {
      return {
        rows: results,
        fields: fields ? fields.map(f => f.name) : fields,
      };
    } else {
      return {
        affected: results.affectedRows,
        insertId: results.insertId,
      };
    }
  }
}