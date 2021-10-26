const express = require("express");
const app = express();
const bp = require("body-parser");
const qr = require("qrcode");
var formidable = require('formidable');
var fs = require('fs');
const excelToJson = require('convert-excel-to-json');
const zipdir = require('zip-dir');
const path = require('path');

// Using the ejs (Embedded JavaScript templates) as our template engine
// and call the body parser  - middleware for parsing bodies from URL
//                           - middleware for parsing json objects

app.set("view engine", "ejs");
app.use(bp.urlencoded({ extended: false }));
app.use(bp.json());
app.use('/files', express.static('files'));

// Simple routing to the index.ejs file
app.get("/", (req, res) => {
  res.render("index");
});

app.post("/scan", (req, res) => {
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
    var oldpath = files.filetoupload.path;
    var newpath = 'tmp/' + files.filetoupload.name;
    fs.rename(oldpath, newpath, function (err) {
      if (err) throw err;
        excelJson = excelToJson({
          sourceFile: newpath,
          sheets: ['Foglio1'],
          columnToKey: {
            A: 'url',
          }
        });

        fs.unlinkSync(newpath);

        var fileName = files.filetoupload.name.replace(/\.[^/.]+$/, "");

        const promises = [];

        //generazione dei qrcode dagli url
        excelJson['Foglio1'].forEach(url => {
          urlNameArray = url[ 'url' ].split('/');
          urlName = urlNameArray.pop() || urlNameArray.pop();

          promises.push(
            new Promise((resolve, reject) => {
              qr.toFile('qrcodes/' + urlName + '.png',url[ 'url' ], (err) => {
                if (err) reject(err);
                else resolve();
              });
            })
          );

        });

        var zipFileName = 'files/' + fileName + '.zip';

        //compressione cartella dei qrcode
        Promise.all(promises).then(() => {
          promises.push(
            new Promise((resolve, reject) => {
              var buffer = zipdir('qrcodes/');
              zipdir('qrcodes/', { saveTo: zipFileName }, function (err, buffer) {
                if (err) reject(err);
                else resolve();
              });
            })
          );
        }).catch(err => console.log(err));

        //eliminazione dei qrcode generati
        Promise.all(promises).then(() => {
          var directory = 'qrcodes/';
          fs.readdir(directory, (err, files) => {
            if (err) reject(err);
          
            for (const file of files) {
              fs.access(path.join(directory, file), fs.F_OK, (err) => {
                if (err) {
                  console.error(err)
                  return
                }
                promises.push(
                  new Promise((resolve, reject) => {
                    fs.unlink(path.join(directory, file), err => {
                      if (err) reject(err);
                      else resolve();
                    });
                  })
                );
              })
            }
          });
        }).catch(err => console.log(err));
        
        Promise.all(promises).then(() => {
          res.render("scan", { zipFileName });
          res.end();
        }).catch(err => console.log(err));

    })
  });

  // const url = req.body.url;

  // // If the input is null return "Empty Data" error
  // if (url.length === 0) res.send("Empty Data!");
  
  // qr.toDataURL(url, (err, src) => {
  //     if (err) res.send("Error occured");
  //     res.render("scan", { src });
  // });

});

// Setting up the port for listening requests
const port = 5000;
app.listen(port, () => console.log("Server at 5000"));