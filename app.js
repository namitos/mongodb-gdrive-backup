const fs = require('fs');

const google = require('googleapis');
const drive = google.drive('v3');
const moment = require('moment');

const conf = require(process.env.conf ? process.env.conf : './conf');

let jwtClient = new google.auth.JWT(conf.googleServiceAccount.client_email, null, conf.googleServiceAccount.private_key, [
  'https://www.googleapis.com/auth/drive'
], null);
google.options({auth: jwtClient});


function sendBackup(emailToShare, name, buffer) {
  return new Promise((resolve, reject) => {
    jwtClient.authorize((err, tokens) => {
      if (err) {
        console.log('authorize', err);
        reject(err);
      } else {
        drive.files.create({
          resource: {
            name: name,
            mimeType: 'application/tar+gzip'
          },
          media: {
            mimeType: 'application/tar+gzip',
            body: buffer
          }
        }, function (err, file) {
          if (err) {
            reject(err);
          } else {
            drive.permissions.create({
              fileId: file.id,
              sendNotificationEmail: false,
              resource: {
                role: 'reader',
                type: 'user',
                emailAddress: emailToShare,
                value: emailToShare
              }
            }, (err, res) => {
              err ? reject(err) : resolve(res);
            });
          }
        });
      }
    });
  });
}

function exec(command, options) {
  return new Promise((resolve, reject) => {
    require('child_process').exec(command, options, (error, stdout, stderr) => {
      error ? reject(error) : resolve(stdout);
    })
  });
}

function dump() {
  exec(`mongodump --host ${conf.mongo.host ? conf.mongo.host : '127.0.0.1'}:${conf.mongo.port ? conf.mongo.port : '27017'} && tar -cvzf dump.tar.gz dump && rm -rf dump`)
    .then(() => sendBackup(conf.backup.shareTo, (conf.backup.fileName ? conf.backup.fileName : 'Backup') + ' ' + new Date().toString() + '.tar.gz', fs.createReadStream('dump.tar.gz')))
    .then(() => exec('rm dump.tar.gz'))
    .then(() => {
      console.log('backup success');
      //cleaning old files
      drive.files.list({
        pageSize: 1000,
        q: "modifiedTime < '" + moment().subtract(conf.backup.deleteTimeout ? conf.backup.deleteTimeout : 14, 'days').format("YYYY-MM-DDTHH:mm:ss") + "'"
      }, (err, resp) => {
        resp.files.forEach((file) => {
          drive.files.delete({
            fileId: file.id
          }, (err, result) => {
            console.log(err, result)
          });
        });
      });
    })
    .catch((err) => {
      console.error('error:', err);
    });
}

dump();
setInterval(dump, conf.backup.interval ? conf.backup.interval : 1000 * 60 * 60 * 4);
