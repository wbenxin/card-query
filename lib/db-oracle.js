const log4js = require('log4js');
const oracledb = require('oracledb');

const s_pool = Symbol('pool');
const s_execute = Symbol('execute');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const logger = log4js.getLogger();

class Oracle {
  constructor(pool) {
    this.driver = 'oracle';
    this[s_pool] = pool;
  }

  async getConnection() {
    return await this[s_pool].getConnection();
  }

  async [s_execute](conn, sql, values = []) {
    const begin = process.hrtime();
    const raw_result = await conn.execute(format_sql(sql), values, {
      autoCommit: true,
    });
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
      await conn.close();
    }
  }

  /**
   * 事务执行
   * @param {(execute:(sql,values)=>Promise<{rows, fields}>)} callback 在事务中执行的回调函数
   */
  async trans(callback) {
    logger.debug(`start transaction`);
    const conn = await this[s_pool].getConnection();
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
      conn.close();
    }
  }

  /**
   * 格式化sql执行结果
   * @param {object}} result 
   */
  format_result(result) {
    return {
      rows: result.rows,
      fields: result.metaData,
      affected: result.rowsAffected,
      insertId: result.lastRowid,
    };
  }
}

/**
 * 格式化mysql风格的SQL
 * 1. 将sql中的mysql格式的参数占位符'?'改为oracle格式的':'
 * 2. 去掉SYSDATE()的括号
 * @param {string} sql 原始SQL
 */
function format_sql(sql) {
  let i = 1;
  let new_sql = sql.replace(/\?/g, () => ':' + (i++));
  return new_sql.replace(/SYSDATE\(\)/ig, 'SYSDATE');
}

module.exports = async function (config) {
  const pool = await oracledb.createPool(config);
  return new Oracle(pool);
};