const query = require('./index');
const log4js = require('log4js');

log4js.configure({
  appenders: {
    console: {
      type: 'console'
    }
  },
  categories: {
    default: { appenders: ['console'], level: 'DEBUG' },
  }
});

setImmediate(async () => {
  await query.configure({
    default: {
      connectString: 'localhost/orcl',
      user: 'user',
      password: 'password',
    },
    AmyDB: {
      connectString: 'localhost/orcl',
      user: 'user',
      password: 'password',
    },
  });

  try {
    await query.getDatabase().trans(async exec => {
      await exec("select 1 from dual");
      throw Error('test');
    });
  } catch (e) {
    console.error(e);
  }

  console.log('done');
});