const fs = require('fs');

const { google } = require('googleapis');
const drive = google.drive('v3');
const moment = require('moment');

// var followRedirects = require('follow-redirects');
// followRedirects.maxBodyLength = 4000 * 1024 * 1024; // 2000 MB

const conf = require(process.env.conf ? process.env.conf : './conf');

let jwtClient = new google.auth.JWT(conf.googleServiceAccount.client_email, null, conf.googleServiceAccount.private_key, ['https://www.googleapis.com/auth/drive'], null);
google.options({ auth: jwtClient });

async function sendBackup({ emailToShare, name, readStream }) {
  let tokens = await jwtClient.authorize();
  console.log('auth ok');
  let file = await drive.files.create({
    resource: {
      name: name,
      mimeType: 'application/tar+gzip'
    },
    media: {
      mimeType: 'application/tar+gzip',
      body: readStream
    }
  });
  console.log('file create ok');
  if (typeof emailToShare === 'string') {
    emailToShare = [emailToShare];
  }

  for (let i = 0; i < emailToShare.length; i++) {
    const email = emailToShare[i];
    await drive.permissions.create({
      fileId: file.data.id,
      sendNotificationEmail: false,
      resource: {
        role: 'reader',
        type: 'user',
        emailAddress: email,
        value: email
      }
    });
  }
  console.log('share ok');
}

function exec(command, options) {
  return new Promise((resolve, reject) => {
    require('child_process').exec(command, options, (error, stdout, stderr) => {
      error ? reject(error) : resolve(stdout);
    });
  });
}

async function clean() {
  //cleaning old files
  try {
    let resp = await drive.files.list({
      pageSize: 1000,
      q:
        "modifiedTime < '" +
        moment()
          .subtract(conf.backup.deleteTimeout ? conf.backup.deleteTimeout : 14, 'days')
          .format('YYYY-MM-DDTHH:mm:ss') +
        "'"
    });
    console.log(`cleaning ${resp.data.files.length} files`);

    resp.data.files.forEach((file) => {
      drive.files.delete(
        {
          fileId: file.id
        },
        (err, result) => {
          if (err) {
            console.error(err);
          } else {
            console.log('clean old file success');
          }
        }
      );
    });
  } catch (err) {
    console.error(err);
  }
}

async function dump() {
  try {
    await exec(`mongodump ${conf.mongo.db ? `--db ${conf.mongo.db}` : ''} --host ${conf.mongo.host ? conf.mongo.host : '127.0.0.1'}:${conf.mongo.port ? conf.mongo.port : '27017'} && tar -cvzf dump.tar.gz dump && rm -rf dump`);
    console.log('dump success');
    await sendBackup({
      emailToShare: conf.backup.shareTo,
      name: (conf.backup.fileName ? conf.backup.fileName : 'Backup') + ' ' + new Date().toString() + '.tar.gz',
      readStream: fs.createReadStream('./dump.tar.gz')
    });
    await exec('rm dump.tar.gz');
    console.log('backup success');
    clean();
  } catch (err) {
    console.error('error1:', err);
    try {
      if (err.errors[0].reason === 'storageQuotaExceeded') {
        clean();
      }
    } catch (e) {
      console.error('error2:', err);
    }
  }
}

dump();
setInterval(dump, conf.backup.interval ? conf.backup.interval : 1000 * 60 * 60 * 4);
