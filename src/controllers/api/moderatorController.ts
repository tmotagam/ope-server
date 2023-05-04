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
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { createSecretKey, randomBytes } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { Types } from 'mongoose';

import { Examinee, Moderator } from '../../database/schema/userSchema';
import { Notification } from '../../database/schema/notificationSchema';
import { Test } from '../../database/schema/paperSchema';
import { Compiler } from '../../helpers/compiler';
import { establishConnection } from '../../middlewares/sse';
import { Decrypt, Encrypt } from '../../helpers/encrypt_decrypt';
import { tokenCheck } from '../../middlewares/tokenVerifier';
import { sendcom } from '../../communication/comm';
import { Evaluation } from '../../database/schema/evaluationSchema';
import { Get } from '../../storage/storage';
import { sendCommJob } from '../../jobs/sendcommjob';

interface paper {
  type: 'multiple' | 'single';
  marks: number;
  index: number;
  section: string;
  questionnumber: number;
  question: string;
  option: string[];
  answered: boolean;
  skipped: boolean;
  markedoption: string | string[];
  obtainmarks: number | null;
}

interface answerpaper {
  totalmarks: number;
  marksobtained: number;
  answers: paper[];
}

const notification = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const notifications = await Notification.find({ UserId: moderator._id });
    notifications.reverse();
    return res
      .status(200)
      .json({ notification: notifications.map((n) => n._id) });
  } catch (error) {
    return res.status(400).json({ error: 'Notifications not found' });
  }
};

const notification_details = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const notifications: Array<{
      id: number;
      Id: string;
      Date: Date;
      type: string;
      severity?: string;
      mark: boolean;
      title: string;
      detail: string;
    }> = [];
    const ids = JSON.parse(req.params.ids);
    const crudenotifications = await Notification.find({
      $and: [
        {
          _id: {
            $in: ids.ids,
          },
        },
        { UserId: req.token.id },
      ],
    });
    crudenotifications.reverse();
    for (let i = 0; i < crudenotifications.length; i++) {
      const element = crudenotifications[i];
      notifications.push({
        id: i + 1,
        Id: element._id,
        title: element.title,
        detail: element.detail,
        type: element.type,
        severity: element.severity,
        mark: element.mark,
        Date: element.Date,
      });
    }
    return res.status(200).json({ notification: notifications });
  } catch (error) {
    return res.status(400).json({ error: 'Notifications not found' });
  }
};

const mark_notification = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const id = req.params.id;
    const notification = await Notification.findOne({
      $and: [
        {
          _id: id,
        },
        { UserId: req.token.id },
        { mark: false },
      ],
    });
    if (notification === null) {
      return res.status(400).json({ error: 'Notification not found' });
    }
    notification.mark = true;
    await notification.save();
    return res.status(200).json({ message: 'Notification marked' });
  } catch (error) {
    return res.status(400).json({ error: 'Notification not found' });
  }
};

const unmark_notification = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const id = req.params.id;
    const notification = await Notification.findOne({
      $and: [
        {
          _id: id,
        },
        { UserId: req.token.id },
        { mark: true },
      ],
    });
    if (notification === null) {
      return res.status(400).json({ error: 'Notification not found' });
    }
    notification.mark = false;
    await notification.save();
    return res.status(200).json({ message: 'Notification unmarked' });
  } catch (error) {
    return res.status(400).json({ error: 'Notification not found' });
  }
};

const delete_notification = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const id = req.params.id;
    await Notification.findOneAndRemove({
      $and: [
        {
          _id: id,
        },
        { UserId: req.token.id },
        { mark: true },
      ],
    });
    if (notification === null) {
      return res.status(400).json({ error: 'Notification not found' });
    }
    return res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    return res.status(400).json({ error: 'Notification not found' });
  }
};

const add_test = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const name = req.body.name;
    const examineeList = JSON.parse(req.body.examlist).examlist;
    const activetesttime: string[] = req.body.time.split(':');
    const WindowStart = new Date(req.body.windowstart);
    const WindowEnd = new Date(req.body.windowend);
    if (activetesttime.length !== 3) {
      return res.status(400).json({ error: 'Cannot add test' });
    }
    if (req.files === undefined) {
      return res.status(400).json({ error: 'Cannot add test' });
    }
    if (Array.isArray(req.files)) {
      return res.status(400).json({ error: 'Cannot add test' });
    }
    let key = createSecretKey(randomBytes(32)).export();
    const encpaper = Encrypt(Compiler(req.files.testfile[0].buffer), key);
    const enckey = Encrypt(key);
    key = Buffer.from('');
    const t = await Test.create({
      UserId: moderator._id,
      name: name,
      date: new Date(),
      examineelist: examineeList,
      testtime: [
        Number(activetesttime[0]),
        Number(activetesttime[1]),
        Number(activetesttime[2]),
      ],
      windowstart: WindowStart,
      windowend: WindowEnd,
      mode: 'ASYNC',
      paper: Buffer.concat([encpaper[2], encpaper[0], encpaper[1]]),
      key: Buffer.concat([enckey[2], enckey[0], enckey[1]]),
      StartTestOn: WindowStart,
      EndTestOn: WindowEnd,
    });
    setTimeout(() => sendCommJob(t._id), 5000);
    return res.status(200).json({ message: 'Test added successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Cannot add test' });
  }
};

const searchExaminees = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const crudeExaminees = await Examinee.find(
      { type: 'EXAMINEE' },
      '_id, name'
    );
    const Examinees: Array<{ value: string; label: string }> = [];
    for (let i = 0; i < crudeExaminees.length; i++) {
      const element = crudeExaminees[i];
      Examinees.push({
        value: element._id,
        label: Decrypt(
          element.name.subarray(0, 32),
          element.name.subarray(element.name.length - 16),
          element.name.subarray(32, element.name.length - 16)
        ).toString(),
      });
    }
    return res.status(200).json({ examinees: Examinees });
  } catch (error) {
    return res.status(400).json({ error: 'Cannot find any examinees' });
  }
};

const tests = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const tests = await Test.find({ UserId: moderator._id });
    tests.reverse();
    return res.status(200).json({ tests: tests.map((t) => t._id) });
  } catch (error) {
    return res.status(400).json({ error: 'Tests not found' });
  }
};

const tests_detail = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const ids = JSON.parse(req.params.ids);
    const tests = await Test.find({
      $and: [
        {
          _id: {
            $in: ids.ids,
          },
        },
        {
          UserId: moderator._id,
        },
      ],
    });
    tests.reverse();
    const testlist = [];
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      testlist.push({
        _id: test._id,
        number: i + 1,
        name: test.name,
        date: test.date,
        testtime: test.testtime,
        examineelist: test.examineelist,
        windowstart: test.windowstart,
        windowend: test.windowend,
      });
    }
    return res.status(200).json({ tests: testlist });
  } catch (error) {
    return res.status(400).json({ error: 'Tests not found' });
  }
};

const test_detail = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const id = req.params.id;
    const test = await Test.findOne({
      $and: [
        {
          _id: id,
        },
        {
          UserId: moderator._id,
        },
      ],
    });
    if (test === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    const bufk = Buffer.from(test.key);
    let key = Decrypt(
      bufk.subarray(0, 32),
      bufk.subarray(bufk.length - 16),
      bufk.subarray(32, bufk.length - 16)
    );
    const dectest = {
      paper: Decrypt(
        test.paper.subarray(0, 32),
        test.paper.subarray(test.paper.length - 16),
        test.paper.subarray(32, test.paper.length - 16),
        key
      ).toString(),
    };
    key = Buffer.from('');
    return res.status(200).json({ test: dectest });
  } catch (error) {
    return res.status(400).json({ error: 'Test not found' });
  }
};

const delete_test = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const id = req.params.id;
    const test = await Test.findOneAndDelete({
      $and: [
        {
          _id: {
            $in: id,
          },
        },
        {
          UserId: moderator._id,
        },
      ],
    });
    if (test === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    return res.status(200).json({ message: 'Test deleted successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Test not found' });
  }
};

const evaluations = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const evaluations = await Evaluation.find({
      $and: [
        { isended: true },
        { evaluator: new Types.ObjectId(req.token.id) },
      ],
    });
    evaluations.reverse();
    return res.status(200).json({
      evaluationsIds: evaluations.map((e) => e._id),
      evaluationsStatus: evaluations.map((e) => e.evaluated),
    });
  } catch (error) {
    return res.status(400).json({ error: 'Evaluations not found' });
  }
};

const evaluations_details = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const ids = JSON.parse(req.params.ids);
    const status = req.params.status;
    const evaluations: Array<{
      id: number;
      Id: string;
      name: string;
      cheated: boolean;
    }> = [];
    const crudeevaluations = await Evaluation.find({
      $and: [
        {
          _id: {
            $in: ids.ids,
          },
        },
        { evaluated: status },
        { evaluator: new Types.ObjectId(req.token.id) },
      ],
    });
    crudeevaluations.reverse();
    for (let i = 0; i < crudeevaluations.length; i++) {
      const element = crudeevaluations[i];
      const test = await Test.findById(element.testid);
      if (test === null) {
        return res.status(400).json({ error: 'Evaluations not found' });
      }
      evaluations.push({
        id: i + 1,
        Id: element._id,
        name: test.name,
        cheated: element.cheated === undefined ? false : true,
      });
    }
    return res.status(200).json({ evaluations: evaluations });
  } catch (error) {
    return res.status(400).json({ error: 'Evaluations not found' });
  }
};

const done_evaluation_details = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const evaluation = await Evaluation.findById(id);
    if (
      evaluation === null ||
      evaluation.evaluated !== true ||
      evaluation.isended !== true ||
      evaluation.evaluator.toString() !== req.token.id
    ) {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    return res.status(200).json({
      questions: JSON.parse(
        Decrypt(
          evaluation.answersheet.subarray(0, 32),
          evaluation.answersheet.subarray(evaluation.answersheet.length - 16),
          evaluation.answersheet.subarray(
            32,
            evaluation.answersheet.length - 16
          ),
          Decrypt(
            evaluation.key.subarray(0, 32),
            evaluation.key.subarray(evaluation.key.length - 16),
            evaluation.key.subarray(32, evaluation.key.length - 16)
          )
        ).toString()
      ),
      ischeated: evaluation.cheated === undefined ? false : true,
    });
  } catch (error) {
    return res.status(400).json({ error: 'Evaluation not found' });
  }
};

const pending_evaluation_details = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const stage = Number(req.params.stage);
    const eid = req.params.id;
    if (stage === 0) {
      const evaluation = await Evaluation.findById(eid);
      if (
        evaluation === null ||
        evaluation.evaluated !== false ||
        evaluation.isended !== true ||
        evaluation.evaluator.toString() !== req.token.id ||
        evaluation.verificationimages === undefined
      ) {
        return res.status(400).json({ error: 'Evaluation not found' });
      }
      const examinee = await Examinee.findById(evaluation.userid);
      if (examinee === null) {
        return res.status(400).json({ error: 'Examinee not found' });
      }
      const image0 = await Get(examinee.image[0].name);
      const image1 = await Get(evaluation.verificationimages[0].name);
      const image2 = await Get(examinee.image[1].name);
      const image3 = await Get(evaluation.verificationimages[1].name);
      return res.status(200).json({
        questions: {
          Stage: 0,
          userId: evaluation.userid,
          Images: [
            image0.toString('base64'),
            image1.toString('base64'),
            image2.toString('base64'),
            image3.toString('base64'),
          ],
          Question: [],
          Totalmarks: 0,
          Marksobtained: 0,
        },
      });
    } else if (stage === 1) {
      const evaluation = await Evaluation.findById(eid);
      if (
        evaluation === null ||
        evaluation.evaluated !== false ||
        evaluation.isended !== true ||
        evaluation.evaluator.toString() !== req.token.id ||
        evaluation.verificationimages === undefined
      ) {
        return res.status(400).json({ error: 'Evaluation not found' });
      }
      const paper = JSON.parse(
        Decrypt(
          evaluation.answersheet.subarray(0, 32),
          evaluation.answersheet.subarray(evaluation.answersheet.length - 16),
          evaluation.answersheet.subarray(
            32,
            evaluation.answersheet.length - 16
          ),
          Decrypt(
            evaluation.key.subarray(0, 32),
            evaluation.key.subarray(evaluation.key.length - 16),
            evaluation.key.subarray(32, evaluation.key.length - 16)
          )
        ).toString()
      );
      return res.status(200).json({
        questions: {
          Stage: 1,
          userId: evaluation.userid,
          Images: [],
          Question: paper.answers,
          Totalmarks: paper.totalmarks,
          Marksobtained: paper.marksobtained,
        },
      });
    } else {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Evaluation not found' });
  }
};

const eval_Examinee_cheated = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const eid = req.params.id;
    const evaluation = await Evaluation.findById(eid);
    if (
      evaluation === null ||
      evaluation.isended !== true ||
      evaluation.evaluator.toString() !== req.token.id ||
      evaluation.verificationimages === undefined
    ) {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    if (evaluation.cheated === undefined) {
      evaluation.cheated = [
        {
          userid: new Types.ObjectId(req.token.id),
          is: true,
          reason: req.body.reason,
          timestamp: Date.now().toString(),
        },
      ];
    } else {
      evaluation.cheated.push({
        userid: new Types.ObjectId(req.token.id),
        is: true,
        reason: req.body.reason,
        timestamp: Date.now().toString(),
      });
    }
    evaluation.evaluated = true;
    await evaluation.save();
    const examinee = await Examinee.findById(evaluation.userid);
    if (examinee === null) {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    await sendcom(
      Decrypt(
        examinee.comid.subarray(0, 32),
        examinee.comid.subarray(examinee.comid.length - 16),
        examinee.comid.subarray(32, examinee.comid.length - 16)
      ).toString(),
      'Evaluation Completed',
      {
        logo: `${process.env.serverurl}public/logo/`,
        username: Decrypt(
          examinee.name.subarray(0, 32),
          examinee.name.subarray(examinee.name.length - 16),
          examinee.name.subarray(32, examinee.name.length - 16)
        ).toString(),
        evalid: evaluation._id,
      },
      'RESULT'
    );
    return res.status(200).json({ message: 'Data saved successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Evaluation not found' });
  }
};

const eval_Video_Data = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (
      evaluation === null ||
      evaluation.isended !== true ||
      evaluation.evaluator.toString() !== req.token.id ||
      evaluation.verificationimages === undefined
    ) {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    if (evaluation.testvideos === undefined) {
      return res.status(418).json({ error: 'Video is not found' });
    }
    const evaluationtestvideo = evaluation.testvideos.find(
      (v) =>
        v.name === `${evaluation.userid}_TEST_STREAM_${req.params.index}.webm`
    )?.name;
    if (evaluationtestvideo === undefined) {
      return res.status(418).json({ error: 'Video is not found' });
    }
    const vidbuff = await Get(evaluationtestvideo);
    res.status(200).send(vidbuff);
  } catch (error) {
    return res.status(400).json({ error: 'Evaluation not found' });
  }
};

const eval_answer_evaluation = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const index = Number(req.body.index);
    const evaluation = await Evaluation.findById(req.body.id);
    if (
      evaluation === null ||
      evaluation.isended !== true ||
      evaluation.evaluator.toString() !== req.token.id ||
      evaluation.verificationimages === undefined
    ) {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    const paper: answerpaper = JSON.parse(
      Decrypt(
        evaluation.answersheet.subarray(0, 32),
        evaluation.answersheet.subarray(evaluation.answersheet.length - 16),
        evaluation.answersheet.subarray(32, evaluation.answersheet.length - 16),
        Decrypt(
          evaluation.key.subarray(0, 32),
          evaluation.key.subarray(evaluation.key.length - 16),
          evaluation.key.subarray(32, evaluation.key.length - 16)
        )
      ).toString()
    );
    const tmppaper = paper.answers[index];
    if (req.body.iscorrect === 'true') {
      if (
        tmppaper.obtainmarks === null &&
        tmppaper.answered === true &&
        tmppaper.skipped === false
      ) {
        tmppaper.obtainmarks = tmppaper.marks;
        paper.marksobtained += tmppaper.marks;
      } else {
        return res.status(400).json({ error: 'Evaluation not found' });
      }
    } else if (req.body.iscorrect === 'false') {
      if (
        tmppaper.obtainmarks === null &&
        tmppaper.answered === true &&
        tmppaper.skipped === false
      ) {
        tmppaper.obtainmarks = 0;
        paper.marksobtained += 0;
      } else {
        return res.status(400).json({ error: 'Evaluation not found' });
      }
    } else {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    paper.answers[index] = tmppaper;
    const encpaper = Encrypt(
      Buffer.from(JSON.stringify(paper)),
      Decrypt(
        evaluation.key.subarray(0, 32),
        evaluation.key.subarray(evaluation.key.length - 16),
        evaluation.key.subarray(32, evaluation.key.length - 16)
      )
    );
    evaluation.answersheet = Buffer.concat([
      encpaper[2],
      encpaper[0],
      encpaper[1],
    ]);
    await evaluation.save();
    return res.status(200).json({
      message: 'Data saved successfully',
      data: JSON.stringify(paper),
    });
  } catch (error) {
    return res.status(400).json({ error: 'Evaluation not found' });
  }
};

const eval_completed = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const eid = req.params.id;
    const evaluation = await Evaluation.findById(eid);
    if (
      evaluation === null ||
      evaluation.isended !== true ||
      evaluation.evaluator.toString() !== req.token.id ||
      evaluation.verificationimages === undefined ||
      evaluation.cheated !== undefined
    ) {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    evaluation.evaluated = true;
    await evaluation.save();
    const examinee = await Examinee.findById(evaluation.userid);
    if (examinee === null) {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    await sendcom(
      Decrypt(
        examinee.comid.subarray(0, 32),
        examinee.comid.subarray(examinee.comid.length - 16),
        examinee.comid.subarray(32, examinee.comid.length - 16)
      ).toString(),
      'Evaluation Completed',
      {
        logo: `${process.env.serverurl}public/logo/`,
        username: Decrypt(
          examinee.name.subarray(0, 32),
          examinee.name.subarray(examinee.name.length - 16),
          examinee.name.subarray(32, examinee.name.length - 16)
        ).toString(),
        evalid: evaluation._id,
      },
      'RESULT'
    );
    return res.status(200).json({ message: 'Data saved successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Evaluation not found' });
  }
};

const eval_answer_reevaluation = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const index = Number(req.body.index);
    const evaluation = await Evaluation.findById(req.body.id);
    if (
      evaluation === null ||
      evaluation.isended !== true ||
      evaluation.evaluated !== true ||
      evaluation.evaluator.toString() !== req.token.id ||
      evaluation.verificationimages === undefined
    ) {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    const paper: answerpaper = JSON.parse(
      Decrypt(
        evaluation.answersheet.subarray(0, 32),
        evaluation.answersheet.subarray(evaluation.answersheet.length - 16),
        evaluation.answersheet.subarray(32, evaluation.answersheet.length - 16),
        Decrypt(
          evaluation.key.subarray(0, 32),
          evaluation.key.subarray(evaluation.key.length - 16),
          evaluation.key.subarray(32, evaluation.key.length - 16)
        )
      ).toString()
    );
    const tmppaper = paper.answers[index];
    if (req.body.iscorrect === 'true') {
      if (
        tmppaper.obtainmarks === null &&
        tmppaper.answered === true &&
        tmppaper.skipped === false
      ) {
        tmppaper.obtainmarks = tmppaper.marks;
        paper.marksobtained += tmppaper.marks;
      } else if (
        tmppaper.answered === true &&
        tmppaper.skipped === false &&
        tmppaper.obtainmarks === 0
      ) {
        tmppaper.obtainmarks = tmppaper.marks;
        paper.marksobtained += tmppaper.marks;
      } else {
        return res.status(400).json({ error: 'Evaluation not found' });
      }
    } else if (req.body.iscorrect === 'false') {
      if (
        tmppaper.obtainmarks === null &&
        tmppaper.answered === true &&
        tmppaper.skipped === false
      ) {
        tmppaper.obtainmarks = 0;
        paper.marksobtained += 0;
      } else if (
        tmppaper.answered === true &&
        tmppaper.skipped === false &&
        tmppaper.obtainmarks === tmppaper.marks
      ) {
        tmppaper.obtainmarks = 0;
        paper.marksobtained -= tmppaper.marks;
      } else {
        return res.status(400).json({ error: 'Evaluation not found' });
      }
    } else {
      return res.status(400).json({ error: 'Evaluation not found' });
    }
    paper.answers[index] = tmppaper;
    const encpaper = Encrypt(
      Buffer.from(JSON.stringify(paper)),
      Decrypt(
        evaluation.key.subarray(0, 32),
        evaluation.key.subarray(evaluation.key.length - 16),
        evaluation.key.subarray(32, evaluation.key.length - 16)
      )
    );
    evaluation.answersheet = Buffer.concat([
      encpaper[2],
      encpaper[0],
      encpaper[1],
    ]);
    await evaluation.save();
    return res.status(200).json({
      message: 'Data saved successfully',
      data: JSON.stringify(paper),
    });
  } catch (error) {
    return res.status(400).json({ error: 'Evaluation not found' });
  }
};

const moderator_event = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    establishConnection(res, 3000);
    tokenCheck(req, res, next);
    const moderatoreventInterval = setInterval(async () => {
      if (req.token === undefined) {
        return;
      }
      const id = req.token.id;
      const moderator = await Moderator.findOne({
        type: 'MODERATOR',
        _id: id,
      });
      if (moderator === null) {
        return res.sse({
          data: 'user not found',
          event: 'ERROR',
        });
      }
      const notifications = await Notification.find({
        $and: [
          {
            UserId: moderator._id,
          },
          {
            notify: true,
          },
        ],
      });
      if (notifications.length !== 0) {
        res.sse({
          data: {
            message: 'New notifications have arrived.',
            notifications: notifications.map((n) => n._id),
          },
          event: 'MODERATOR',
          id: moderator._id,
        });
        for (let i = 0; i < notifications.length; i++) {
          const n = notifications[i];
          n.notify = undefined;
          await n.save();
        }
      }
    }, 1000);

    res.on('finish', () => clearInterval(moderatoreventInterval));
    res.on('close', async () => {
      clearInterval(moderatoreventInterval);
      const notifications = await Notification.find({
        $and: [
          {
            UserId: req.token?.id,
          },
          {
            notify: true,
          },
        ],
      });
      for (let i = 0; i < notifications.length; i++) {
        const n = notifications[i];
        n.notify = undefined;
        await n.save();
      }
    });
  } catch (error) {
    return res.sse({
      data: 'Events error',
      event: 'ERROR',
    });
  }
};

const account_name = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const encname = Encrypt(req.body.name);
    moderator.name = Buffer.concat([encname[2], encname[0], encname[1]]);
    await moderator.save();
    return res
      .status(200)
      .json({ message: 'Name edited successfully', name: req.body.name });
  } catch (error) {
    return res.status(400).json({ error: 'Unable to edit name' });
  }
};

const account_getcomm = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    return res.status(200).json({
      commid: Decrypt(
        moderator.comid.subarray(0, 32),
        moderator.comid.subarray(moderator.comid.length - 16),
        moderator.comid.subarray(32, moderator.comid.length - 16)
      ).toString(),
    });
  } catch (error) {
    return res.status(400).json({ error: 'Unable to get commid' });
  }
};

const account_commid = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const enccommid = Encrypt(req.body.commid);
    moderator.change = {
      commid: Buffer.concat([enccommid[2], enccommid[0], enccommid[1]]),
    };
    const code = randomBytes(256).toString('base64url');
    const dd = new Date();
    moderator.verification = await hash(code, 10);
    moderator.DeleteAccountChangeAfter = new Date(dd.getTime() + 60 * 60000);
    await moderator.save();
    await sendcom(
      Decrypt(
        moderator.comid.subarray(0, 32),
        moderator.comid.subarray(moderator.comid.length - 16),
        moderator.comid.subarray(32, moderator.comid.length - 16)
      ).toString(),
      'Changing communication Id',
      {
        logo: `${process.env.serverurl}public/logo/`,
        name: Decrypt(
          moderator.name.subarray(0, 32),
          moderator.name.subarray(moderator.name.length - 16),
          moderator.name.subarray(32, moderator.name.length - 16)
        ).toString(),
        requestlink: `${process.env.client}#/verification/${code}/${moderator._id}`,
        securelink: `${process.env.client}#/secure/${code}/${moderator._id}`,
      },
      'CCOMM'
    );
    return res.status(200).json({
      message: 'Please verify request from your previous communication id',
    });
  } catch (error) {
    return res.status(400).json({ error: 'Unable to edit communication Id' });
  }
};

const account_password = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderator = await Moderator.findById(req.token.id);
    if (moderator === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const tmpcom = await compare(req.body.currentpassword, moderator.password);
    if (tmpcom && req.body.currentpassword !== req.body.newpassword) {
      const encpassword = await hash(req.body.newpassword, 13);
      moderator.change = {
        password: encpassword,
      };
      const code = randomBytes(256).toString('base64url');
      const dd = new Date();
      moderator.verification = await hash(code, 10);
      moderator.DeleteAccountChangeAfter = new Date(dd.getTime() + 60 * 60000);
      await moderator.save();
      await sendcom(
        Decrypt(
          moderator.comid.subarray(0, 32),
          moderator.comid.subarray(moderator.comid.length - 16),
          moderator.comid.subarray(32, moderator.comid.length - 16)
        ).toString(),
        'Changing password',
        {
          logo: `${process.env.serverurl}public/logo/`,
          name: Decrypt(
            moderator.name.subarray(0, 32),
            moderator.name.subarray(moderator.name.length - 16),
            moderator.name.subarray(32, moderator.name.length - 16)
          ).toString(),
          requestlink: `${process.env.client}#/verification/${code}/${moderator._id}`,
          securelink: `${process.env.client}#/secure/${code}/${moderator._id}`,
        },
        'CHANGEPASSWORD'
      );
      return res.status(200).json({
        message: 'Please verify your request for changing password',
      });
    } else {
      return res.status(400).json({ error: 'Unable to edit password' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Unable to edit password' });
  }
};

export {
  notification,
  notification_details,
  mark_notification,
  unmark_notification,
  delete_notification,
  add_test,
  searchExaminees,
  tests,
  tests_detail,
  test_detail,
  delete_test,
  evaluations,
  evaluations_details,
  done_evaluation_details,
  pending_evaluation_details,
  eval_Examinee_cheated,
  eval_Video_Data,
  eval_answer_evaluation,
  eval_completed,
  eval_answer_reevaluation,
  moderator_event,
  account_commid,
  account_getcomm,
  account_name,
  account_password,
};
