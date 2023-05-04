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
import { Examinee, Moderator } from '../database/schema/userSchema';
import { Test } from '../database/schema/paperSchema';
import { sendcom } from '../communication/comm';
import { Decrypt } from '../helpers/encrypt_decrypt';
import { Notification } from '../database/schema/notificationSchema';

const sendCommJob = async (testid: string) => {
  try {
    const test = await Test.findById(testid);
    if (test === null) {
      return;
    }
    let edone = 0;
    let epen = 0;
    const user = await Moderator.findById(test.UserId);
    if (user === null) {
      return;
    }
    for (let j = 0; j < test.examineelist.length; j++) {
      const examineeId = test.examineelist[j];
      const examinee = await Examinee.findById(examineeId);
      if (examinee === null) {
        epen += 1;
        continue;
      }
      await sendcom(
        Decrypt(
          examinee.comid.subarray(0, 32),
          examinee.comid.subarray(examinee.comid.length - 16),
          examinee.comid.subarray(32, examinee.comid.length - 16)
        ).toString(),
        'Selected for test',
        {
          logo: `${process.env.serverurl}public/logo/`,
          examinee: true,
          username: Decrypt(
            examinee.name.subarray(0, 32),
            examinee.name.subarray(examinee.name.length - 16),
            examinee.name.subarray(32, examinee.name.length - 16)
          ).toString(),
          name: test.name,
          starttime: test.windowstart,
          endtime: test.windowend,
        },
        'TESTSELECT'
      );
      edone += 1;
    }
    await Notification.create({
      UserId: user._id,
      type: 'Notification',
      Date: new Date(),
      title: 'Communication sent successfully',
      mark: false,
      notify: user.Isloggedin === true ? true : undefined,
      detail: `The communication was sent successfully to ${edone} examinees and ${epen} were not found by the database. If there are any pending examinees please review them.`,
    });
    await test.save();
  } catch (error) {}
};

export { sendCommJob };
