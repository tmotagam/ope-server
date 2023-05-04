// OPE Server
// Copyright (C) 2020-2023  Motagamwala Taha Arif Ali

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import { MongoCron } from 'mongodb-cron';
import { MongoClient } from 'mongodb';
import { Types } from 'mongoose';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';

import { Delete } from '../storage/storage';
import { Decrypt } from '../helpers/encrypt_decrypt';
import { sendcom } from '../communication/comm';

const startJobs = async () => {
  const db = process.env.database === undefined ? '' : process.env.database;
  const DB = new MongoClient(db);
  const Logincron = new MongoCron({
    collection: DB.db().collection('Users'),
    sleepUntilFieldPath: 'LogoutUserAfter',
    lockDuration: 300000,
    onDocument: async (doc) => {
      if (doc.Isloggedin === true && doc.tid !== undefined) {
        await DB.db()
          .collection('Users')
          .updateOne(
            { _id: doc._id },
            { $set: { Isloggedin: false }, $unset: { tid: '' } }
          );
      }
    },
  });
  const accountChangecron = new MongoCron({
    collection: DB.db().collection('Users'),
    nextDelay: 2000,
    sleepUntilFieldPath: 'DeleteAccountChangeAfter',
    lockDuration: 300000,
    onDocument: async (doc) => {
      if (doc.change !== undefined) {
        await DB.db()
          .collection('Users')
          .updateOne(
            { _id: doc._id },
            { $unset: { change: '', verification: '' } }
          );
      }
    },
  });
  const notVerifiedcron = new MongoCron({
    collection: DB.db().collection('Users'),
    nextDelay: 2000,
    sleepUntilFieldPath: 'DeleteNVUserAfter',
    lockDuration: 480000,
    onDocument: async (doc) => {
      if (doc.status === 'Not Verified' && doc.verification !== undefined) {
        await DB.db().collection('Users').deleteOne({ _id: doc._id });
      } else if (doc.status === 'InReview' && doc.verification !== undefined) {
        await Delete(doc.image[0].id);
        await Delete(doc.image[1].id);
        await DB.db().collection('Users').deleteOne({ _id: doc._id });
      }
    },
  });
  const forgotpasswordcron = new MongoCron({
    collection: DB.db().collection('Users'),
    nextDelay: 2000,
    sleepUntilFieldPath: 'deletePasswordrequestAfter',
    lockDuration: 300000,
    onDocument: async (doc) => {
      if (doc.verification !== undefined) {
        await DB.db()
          .collection('Users')
          .updateOne({ _id: doc._id }, { $unset: { verification: '' } });
      }
    },
  });
  const starttestcron = new MongoCron({
    collection: DB.db().collection('Tests'),
    sleepUntilFieldPath: 'StartTestOn',
    lockDuration: 1200000,
    onDocument: async (doc) => {
      if (doc.starttest === undefined) {
        await DB.db()
          .collection('Tests')
          .updateOne({ _id: doc._id }, { $set: { starttest: true } });
        for (let j = 0; j < doc.examineelist.length; j++) {
          const examineeId = new Types.ObjectId(doc.examineelist[j]);
          const code = randomBytes(256).readUInt32BE().toString();
          const hashCode = await hash(code, 10);
          await DB.db()
            .collection('Users')
            .updateOne(
              { _id: examineeId },
              { $set: { testcode: { tid: doc._id, tcode: hashCode } } }
            );
          const examinee = await DB.db()
            .collection('Users')
            .findOne({ _id: examineeId });
          if (examinee === null) {
            throw 'error';
          }
          await sendcom(
            Decrypt(
              examinee.comid.buffer.subarray(0, 32),
              examinee.comid.buffer.subarray(examinee.comid.buffer.length - 16),
              examinee.comid.buffer.subarray(
                32,
                examinee.comid.buffer.length - 16
              )
            ).toString(),
            'Test is now active',
            {
              logo: `${process.env.serverurl}public/logo/`,
              examinee: true,
              username: Decrypt(
                examinee.name.buffer.subarray(0, 32),
                examinee.name.buffer.subarray(examinee.name.buffer.length - 16),
                examinee.name.buffer.subarray(
                  32,
                  examinee.name.buffer.length - 16
                )
              ).toString(),
              name: doc.name,
              code: code,
              id: doc._id,
            },
            'TESTSTART'
          );
        }
      }
    },
  });
  const endtestcron = new MongoCron({
    collection: DB.db().collection('Tests'),
    sleepUntilFieldPath: 'EndTestOn',
    lockDuration: 1200000,
    onDocument: async (doc) => {
      if (doc.endtest === undefined && doc.starttest === true) {
        await DB.db()
          .collection('Tests')
          .updateOne(
            { _id: doc._id },
            { $set: { endtest: true }, $unset: { starttest: '' } }
          );
        for (let j = 0; j < doc.examineelist.length; j++) {
          const examineeId = new Types.ObjectId(doc.examineelist[j]);
          await DB.db()
            .collection('Users')
            .updateOne({ _id: examineeId }, { $unset: { testcode: '' } });
        }
        for (let j = 0; j < doc.inactiveexamineelist.length; j++) {
          const iadata = doc.inactiveexamineelist[j];
          if (iadata.isverified === false) {
            await DB.db()
              .collection('Evaluations')
              .deleteOne({
                $and: [{ userid: iadata.id }, { testid: doc._id }],
              });
          } else {
            await DB.db()
              .collection('Evaluations')
              .updateOne(
                { $and: [{ userid: iadata.id }, { testid: doc._id }] },
                { $set: { isended: true } }
              );
          }
        }
        await DB.db()
          .collection('Tests')
          .updateOne({ _id: doc._id }, { $set: { inactiveexamineelist: [] } });
        for (let j = 0; j < doc.notverifiedexamineelist.length; j++) {
          const iadata = doc.notverifiedexamineelist[j];
          await DB.db()
            .collection('Evaluations')
            .deleteOne({
              $and: [{ userid: iadata.id }, { testid: doc._id }],
            });
        }
        await DB.db()
          .collection('Tests')
          .updateOne(
            { _id: doc._id },
            { $set: { notverifiedexamineelist: [] } }
          );
      }
    },
  });
  Logincron.start();
  accountChangecron.start();
  notVerifiedcron.start();
  forgotpasswordcron.start();
  starttestcron.start();
  endtestcron.start();
};

export { startJobs };
