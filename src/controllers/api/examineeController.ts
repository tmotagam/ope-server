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
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { createSecretKey, randomBytes } from 'crypto';
import { hash, compare } from 'bcryptjs';
import { Types } from 'mongoose';
import { promises } from 'fs';
import { Readable } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import { resolve } from 'path';

import { Examinee } from '../../database/schema/userSchema';
import { establishConnection } from '../../middlewares/sse';
import { tokenCheck } from '../../middlewares/tokenVerifier';
import { sendcom } from '../../communication/comm';
import { Encrypt, Decrypt } from '../../helpers/encrypt_decrypt';
import { Test } from '../../database/schema/paperSchema';
import { Evaluation } from '../../database/schema/evaluationSchema';
import { New, Get, Update } from '../../storage/storage';

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

interface option {
  can_navigate: boolean;
  can_skip: boolean;
  submit_means_final: boolean;
  can_end_test: boolean;
  see_question_list: boolean;
}

interface answerpaper {
  totalmarks: number;
  marksobtained: number;
  answers: paper[];
}

const startexam = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.token.id;
    const examid = req.body.examid;
    const code = req.body.code;
    const examinee = await Examinee.findById(id);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    if (examinee.testcode !== undefined && examinee.testcode.tid === examid) {
      if (await compare(code, examinee.testcode.tcode)) {
        const test = await Test.findById(examid);
        if (test === null) {
          return res
            .status(400)
            .json({ error: 'Cannot get examination details' });
        }
        if (test.starttest !== true || test.endtest === true) {
          return res
            .status(400)
            .json({ error: 'Cannot get examination details' });
        }
        const tmpe = test.examineelist.find((e) => e.toString() === id);
        if (tmpe === undefined) {
          return res
            .status(400)
            .json({ error: 'Cannot get examination details' });
        }
        const paper = JSON.parse(
          Decrypt(
            test.paper.subarray(0, 32),
            test.paper.subarray(test.paper.length - 16),
            test.paper.subarray(32, test.paper.length - 16),
            Decrypt(
              test.key.subarray(0, 32),
              test.key.subarray(test.key.length - 16),
              test.key.subarray(32, test.key.length - 16)
            )
          ).toString()
        );
        const data = test.inactiveexamineelist.find(
          (e) => e.id.toString() === id
        );
        const ev = await Evaluation.findOne({ userid: id, testid: examid });
        if (data === undefined && ev === null) {
          test.notverifiedexamineelist.push({
            id: examinee._id,
            time: test.testtime,
            isverified: false,
          });
          let key = createSecretKey(randomBytes(32)).export();
          const encpaper = Encrypt(
            Buffer.from(
              JSON.stringify({
                totalmarks: paper.totalmarks,
                marksobtained: 0,
                answers: paper.paper,
              })
            ),
            key
          );
          const enckey = Encrypt(key);
          key = Buffer.from('');
          await Evaluation.create({
            userid: examinee._id,
            testid: test._id,
            mode: 'ASYNC',
            answersheet: Buffer.concat([encpaper[2], encpaper[0], encpaper[1]]),
            key: Buffer.concat([enckey[2], enckey[0], enckey[1]]),
            evaluator: test.UserId,
          });
          await test.save();
          return res.json({ instruction: paper.option, status: 'NEW' });
        } else if (data !== undefined && ev !== null && ev.isended === false) {
          if (data.isverified === false) {
            if (
              data.time[0] === 0 &&
              data.time[1] === 0 &&
              data.time[2] === 0
            ) {
              return res.status(400).json({ error: 'Enter details correctly' });
            }
            test.notverifiedexamineelist.push(data);
            test.inactiveexamineelist.splice(
              test.inactiveexamineelist.indexOf(data),
              1
            );
            await test.save();
            return res.json({ instruction: paper.option, status: 'NEW' });
          } else {
            if (
              data.time[0] === 0 &&
              data.time[1] === 0 &&
              data.time[2] === 0
            ) {
              return res.status(400).json({ error: 'Enter details correctly' });
            }
            test.activeexamineelist.push(data);
            test.inactiveexamineelist.splice(
              test.inactiveexamineelist.indexOf(data),
              1
            );
            const ev = await Evaluation.findOne({ userid: id, testid: examid });
            if (ev === null) {
              return res.status(400).json({ error: 'Enter details correctly' });
            }
            const answers = JSON.parse(
              Decrypt(
                ev.answersheet.subarray(0, 32),
                ev.answersheet.subarray(ev.answersheet.length - 16),
                ev.answersheet.subarray(32, ev.answersheet.length - 16),
                Decrypt(
                  ev.key.subarray(0, 32),
                  ev.key.subarray(ev.key.length - 16),
                  ev.key.subarray(32, ev.key.length - 16)
                )
              ).toString()
            ).answers;
            await test.save();
            return res.json({
              testname: test.name,
              marks: paper.totalmarks,
              instruction: paper.option,
              status: 'OLD',
              paper: answers,
              timeremain: test.testtime,
            });
          }
        } else {
          return res.status(400).json({ error: 'Enter details correctly' });
        }
      } else {
        return res.status(400).json({ error: 'Enter details correctly' });
      }
    } else {
      return res.status(400).json({ error: 'Examination not yet started' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Cannot get examination details' });
  }
};

const examverificationimages = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const examid = req.body.examid;
    const id = req.token?.id;
    const examinee = await Examinee.findById(id);
    const test = await Test.findById(examid);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    if (test === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    const tmpdata = test.notverifiedexamineelist.find(
      (e) => e.id.toString() === id
    );
    if (examinee.testcode?.tid === examid && tmpdata !== undefined) {
      const evaluation = await Evaluation.findOne({
        userid: id,
        testid: examid,
      });
      if (evaluation === null) {
        return res.status(400).json({ error: 'Test not found' });
      }
      if (evaluation.isended === true) {
        return res.status(400).json({ error: 'Test not found' });
      }
      if (req.files === undefined) {
        return res.status(400).json({ error: 'Verification images error' });
      }
      if (Array.isArray(req.files)) {
        return res.status(400).json({ error: 'Verification images error' });
      }
      if (req.files.images.length !== 2) {
        return res.status(400).json({ error: 'Verification images error' });
      }
      const files = req.files.images;
      const iobject: Array<{ name: string; id: string }> = [];
      for (let i = 0; i < files.length; i++) {
        iobject.push({
          name:
            i === 0
              ? `${id}_TEST_PHOTO_.${files[i].mimetype.split('/')[1]}`
              : `${id}_TEST_PROOF_.${files[i].mimetype.split('/')[1]}`,
          id: await New(
            files[i].buffer,
            files[i].mimetype.split('/')[1],
            i === 0 ? `${id}_TEST_PHOTO_` : `${id}_TEST_PROOF_`
          ),
        });
      }
      evaluation.verificationimages = iobject;
      await evaluation.save();
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
      test.activeexamineelist.push({
        id: tmpdata.id,
        time: tmpdata.time,
        isverified: true,
      });
      test.notverifiedexamineelist.splice(
        test.notverifiedexamineelist.indexOf(tmpdata),
        1
      );
      await test.save();
      return res.json({
        paper: paper.answers,
        testname: test.name,
        marks: paper.totalmarks,
        timeremain: test.testtime,
      });
    } else {
      return res.status(400).json({ error: 'Cannot save Verification Images' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Cannot save Verification Images' });
  }
};

const submitanswers = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const examid = req.body.examid;
    const id = req.token.id;
    const examinee = await Examinee.findById(id);
    const test = await Test.findById(examid);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    if (test === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    const edata = test.activeexamineelist.find((e) => e.id.toString() === id);
    if (edata !== undefined) {
      const evaluation = await Evaluation.findOne({
        userid: id,
        testid: examid,
      });
      if (evaluation === null) {
        return res.status(400).json({ error: 'Test not found' });
      }
      if (evaluation.isended === true) {
        return res.status(400).json({ error: 'Test not found' });
      }
      const options: option = JSON.parse(
        Decrypt(
          test.paper.subarray(0, 32),
          test.paper.subarray(test.paper.length - 16),
          test.paper.subarray(32, test.paper.length - 16),
          Decrypt(
            test.key.subarray(0, 32),
            test.key.subarray(test.key.length - 16),
            test.key.subarray(32, test.key.length - 16)
          )
        ).toString()
      ).option;
      const paper: answerpaper = JSON.parse(
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
      if (options.submit_means_final === true) {
        const question = paper.answers.find(
          (v) => v.answered === false && v.index === Number(req.body.index)
        );
        if (question === undefined) {
          return res.status(400).json({ error: 'Cannot save answers' });
        }
        if (question.skipped === true) {
          return res.status(400).json({ error: 'Cannot save answers' });
        }
        question.answered = true;
        question.markedoption = req.body.answer;
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
        await test.save();
        return res.status(200).json({ message: 'answer saved successfully' });
      } else {
        const question = paper.answers.find(
          (v) => v.index === Number(req.body.index)
        );
        if (question === undefined) {
          return res.status(400).json({ error: 'Cannot save answers' });
        }
        if (question.skipped === true) {
          return res.status(400).json({ error: 'Cannot save answers' });
        }
        question.answered = true;
        question.markedoption = req.body.answer;
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
        await test.save();
        return res.status(200).json({ message: 'answer saved successfully' });
      }
    } else {
      return res.status(400).json({ error: 'Cannot save answers' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Cannot save answers' });
  }
};

const skipanswers = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const examid = req.body.examid;
    const id = req.token.id;
    const examinee = await Examinee.findById(id);
    const test = await Test.findById(examid);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    if (test === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    const edata = test.activeexamineelist.find((e) => e.id.toString() === id);
    if (edata !== undefined) {
      const evaluation = await Evaluation.findOne({
        userid: id,
        testid: examid,
      });
      if (evaluation === null) {
        return res.status(400).json({ error: 'Test not found' });
      }
      if (evaluation.isended === true) {
        return res.status(400).json({ error: 'Test not found' });
      }
      const options: option = JSON.parse(
        Decrypt(
          test.paper.subarray(0, 32),
          test.paper.subarray(test.paper.length - 16),
          test.paper.subarray(32, test.paper.length - 16),
          Decrypt(
            test.key.subarray(0, 32),
            test.key.subarray(test.key.length - 16),
            test.key.subarray(32, test.key.length - 16)
          )
        ).toString()
      ).option;
      const paper: answerpaper = JSON.parse(
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
      if (options.can_skip === true) {
        const question = paper.answers.find(
          (v) => v.answered === false && v.index === Number(req.body.index)
        );
        if (question === undefined) {
          return res.status(400).json({ error: 'Cannot skip answer' });
        }
        if (question.skipped === true) {
          return res.status(400).json({ error: 'Cannot skip answer' });
        }
        question.answered = true;
        question.skipped = true;
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
        await test.save();
        return res.status(200).json({ message: 'answer skipped successfully' });
      } else {
        return res.status(400).json({ error: 'Cannot skip answer' });
      }
    } else {
      return res.status(400).json({ error: 'Cannot skip answer' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Cannot skip answer' });
  }
};

const endtest = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const examid = req.params.id;
    const id = req.token.id;
    const examinee = await Examinee.findById(id);
    const test = await Test.findById(examid);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    if (test === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    const paper = JSON.parse(
      Decrypt(
        test.paper.subarray(0, 32),
        test.paper.subarray(test.paper.length - 16),
        test.paper.subarray(32, test.paper.length - 16),
        Decrypt(
          test.key.subarray(0, 32),
          test.key.subarray(test.key.length - 16),
          test.key.subarray(32, test.key.length - 16)
        )
      ).toString()
    ).option;
    const edata = test.activeexamineelist.find((e) => e.id.toString() === id);
    const ev = await Evaluation.findOne({ userid: id, testid: examid });
    if (
      edata !== undefined &&
      ev !== null &&
      ev.isended !== true &&
      paper.can_end_test === true
    ) {
      test.activeexamineelist.splice(test.activeexamineelist.indexOf(edata), 1);
      examinee.testcode = undefined;
      await examinee.save();
      await test.save();
      return res.status(200).json({ error: 'Cannot end test' });
    } else {
      return res.status(400).json({ error: 'Cannot end test' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Cannot end test' });
  }
};

const cheating = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const token = req.token;
    let caughtflag = false;
    const examinee = await Examinee.findById(token.id);
    const test = await Test.findById(req.body.examid);
    const evaluation = await Evaluation.findOne({
      userid: token.id,
      testid: req.body.examid,
    });
    if (test === null || evaluation === null || examinee === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    for (let i = 0; i < test.activeexamineelist.length; i++) {
      const element = test.activeexamineelist[i];
      if (element.id.toString() === token.id) {
        caughtflag = true;
        element.time = [0, 0, 0];
        test.activeexamineelist[i] = element;
        break;
      }
    }
    if (caughtflag === false) {
      const i = test.notverifiedexamineelist.findIndex((v) => {
        return v.id.toString() === token.id;
      });
      if (i === -1) {
        return res.status(400).json({ error: 'Cannot end test' });
      }
      examinee.testcode = undefined;
      test.notverifiedexamineelist.splice(i, 1);
      await evaluation.delete();
      await examinee.save();
      await test.save();
      return res.status(400).json({ message: 'cheating caught successfully' });
    }
    if (evaluation.cheated === undefined) {
      evaluation.cheated = [
        {
          userid: new Types.ObjectId(token.id),
          is: true,
          reason: req.body.reason,
          timestamp: Date.now().toString(),
        },
      ];
    } else {
      evaluation.cheated.push({
        userid: new Types.ObjectId(token.id),
        is: true,
        reason: req.body.reason,
        timestamp: Date.now().toString(),
      });
    }
    evaluation.evaluated = true;
    await evaluation.save();
    await test.save();
    sendcom(
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
    return res.status(400).json({ message: 'cheating caught successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Cannot end test' });
  }
};

const endstream = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const examid = req.body.examid;
    const id = req.token?.id;
    const examinee = await Examinee.findById(id);
    const test = await Test.findById(examid);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    if (test === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    const evaluation = await Evaluation.findOne({
      userid: id,
      testid: examid,
    });
    if (evaluation === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    if (evaluation.isended === true) {
      return res.status(400).json({ error: 'Test not found' });
    }
    if (req.files === undefined) {
      return res.status(400).json({ error: 'Cannot save stream' });
    }
    if (Array.isArray(req.files)) {
      return res.status(400).json({ error: 'Cannot save stream' });
    }
    const file = req.files.stream[0];
    const d = Date.now().toString();
    const ff = ffmpeg({ source: Readable.from(file.buffer) })
      .addOption(['-err_detect', 'ignore_err'])
      .addOption(['-c', 'copy'])
      .addOutput(`stream_${d}.webm`)
      .once('end', async () => {
        try {
          if (evaluation.testvideos === undefined) {
            const mbu = await promises.readFile(`stream_${d}.webm`);
            evaluation.testvideos = [
              {
                name: `${id}_TEST_STREAM_${req.params.question}.${
                  file.mimetype.split('/')[1]
                }`,
                id: await New(
                  mbu,
                  file.mimetype.split('/')[1],
                  `${id}_TEST_STREAM_${req.params.question}`
                ),
              },
            ];
            await promises.unlink(`stream_${d}.webm`);
            evaluation.isended = true;
            await evaluation.save();
            return res.json({ message: 'Stream saved successfully' });
          } else {
            const findelement = evaluation.testvideos.findIndex(
              (v) =>
                v.name ===
                `${id}_TEST_STREAM_${req.params.question}.${
                  file.mimetype.split('/')[1]
                }`
            );
            if (findelement === -1) {
              const mbu = await promises.readFile(`stream_${d}.webm`);
              evaluation.testvideos.push({
                name: `${id}_TEST_STREAM_${req.params.question}.${
                  file.mimetype.split('/')[1]
                }`,
                id: await New(
                  mbu,
                  file.mimetype.split('/')[1],
                  `${id}_TEST_STREAM_${req.params.question}`
                ),
              });
              await promises.unlink(`stream_${d}.webm`);
              evaluation.isended = true;
              await evaluation.save();
              return res.json({ message: 'Stream saved successfully' });
            } else {
              const dd = Date.now().toString();
              const nwfi = await Get(evaluation.testvideos[findelement].name);
              await promises.writeFile(`stream_${dd}.webm`, nwfi);
              const ddd = Date.now().toString();
              await promises.writeFile(
                `textfile_${ddd}.txt`,
                `file '${resolve(`stream_${dd}.webm`)}' \nfile '${resolve(
                  `stream_${d}.webm`
                )}'`
              );
              const ff = ffmpeg()
                .addInput(`textfile_${ddd}.txt`)
                .addInputOption(['-f concat', '-safe 0'])
                .addOutputOption(['-c copy'])
                .addOutput(`stream_${ddd}.webm`)
                .once('end', async () => {
                  try {
                    const mbu = await promises.readFile(`stream_${ddd}.webm`);
                    if (evaluation.testvideos === undefined) {
                      return res
                        .status(400)
                        .json({ error: 'Cannot save stream' });
                    }
                    evaluation.testvideos.push({
                      name: `${id}_TEST_STREAM_${req.params.question}.${
                        file.mimetype.split('/')[1]
                      }`,
                      id: await Update(
                        mbu,
                        evaluation.testvideos[findelement].id,
                        file.mimetype.split('/')[1],
                        `${id}_TEST_STREAM_${req.params.question}`
                      ),
                    });
                    evaluation.testvideos.splice(findelement, 1);
                    evaluation.isended = true;
                    await evaluation.save();
                    await promises.unlink(`stream_${ddd}.webm`);
                    await promises.unlink(`textfile_${ddd}.txt`);
                    await promises.unlink(`stream_${dd}.webm`);
                    await promises.unlink(`stream_${d}.webm`);
                    return res.json({ message: 'Stream saved successfully' });
                  } catch (error) {
                    return res
                      .status(400)
                      .json({ error: 'Cannot save stream' });
                  }
                });
              ff.run();
            }
          }
        } catch (error) {
          return res.status(400).json({ error: 'Cannot save stream' });
        }
      });
    ff.run();
  } catch (error) {
    return res.status(400).json({ error: 'Cannot save stream' });
  }
};

const savestream = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const examid = req.body.examid;
    const id = req.token?.id;
    const examinee = await Examinee.findById(id);
    const test = await Test.findById(examid);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    if (test === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    const evaluation = await Evaluation.findOne({
      userid: id,
      testid: examid,
    });
    if (evaluation === null) {
      return res.status(400).json({ error: 'Test not found' });
    }
    if (evaluation.isended === true) {
      return res.status(400).json({ error: 'Test not found' });
    }
    if (req.files === undefined) {
      return res.status(400).json({ error: 'Cannot save stream' });
    }
    if (Array.isArray(req.files)) {
      return res.status(400).json({ error: 'Cannot save stream' });
    }
    const file = req.files.stream[0];
    const d = Date.now().toString();
    const ff = ffmpeg({ source: Readable.from(file.buffer) })
      .addOption(['-err_detect', 'ignore_err'])
      .addOption(['-c', 'copy'])
      .addOutput(`stream_${d}.webm`)
      .once('end', async () => {
        try {
          if (evaluation.testvideos === undefined) {
            const mbu = await promises.readFile(`stream_${d}.webm`);
            evaluation.testvideos = [
              {
                name: `${id}_TEST_STREAM_${req.params.question}.${
                  file.mimetype.split('/')[1]
                }`,
                id: await New(
                  mbu,
                  file.mimetype.split('/')[1],
                  `${id}_TEST_STREAM_${req.params.question}`
                ),
              },
            ];
            await promises.unlink(`stream_${d}.webm`);
            await evaluation.save();
            return res.json({ message: 'Stream saved successfully' });
          } else {
            const findelement = evaluation.testvideos.findIndex(
              (v) =>
                v.name ===
                `${id}_TEST_STREAM_${req.params.question}.${
                  file.mimetype.split('/')[1]
                }`
            );
            if (findelement === -1) {
              const mbu = await promises.readFile(`stream_${d}.webm`);
              evaluation.testvideos.push({
                name: `${id}_TEST_STREAM_${req.params.question}.${
                  file.mimetype.split('/')[1]
                }`,
                id: await New(
                  mbu,
                  file.mimetype.split('/')[1],
                  `${id}_TEST_STREAM_${req.params.question}`
                ),
              });
              await promises.unlink(`stream_${d}.webm`);
              await evaluation.save();
              return res.json({ message: 'Stream saved successfully' });
            } else {
              const dd = Date.now().toString();
              const nwfi = await Get(evaluation.testvideos[findelement].name);
              await promises.writeFile(`stream_${dd}.webm`, nwfi);
              const ddd = Date.now().toString();
              await promises.writeFile(
                `textfile_${ddd}.txt`,
                `file '${resolve(`stream_${dd}.webm`)}' \nfile '${resolve(
                  `stream_${d}.webm`
                )}'`
              );
              const ff = ffmpeg()
                .addInput(`textfile_${ddd}.txt`)
                .addInputOption(['-f concat', '-safe 0'])
                .addOutputOption(['-c copy'])
                .addOutput(`stream_${ddd}.webm`)
                .once('end', async () => {
                  try {
                    const mbu = await promises.readFile(`stream_${ddd}.webm`);
                    if (evaluation.testvideos === undefined) {
                      return res
                        .status(400)
                        .json({ error: 'Cannot save stream' });
                    }
                    evaluation.testvideos.push({
                      name: `${id}_TEST_STREAM_${req.params.question}.${
                        file.mimetype.split('/')[1]
                      }`,
                      id: await Update(
                        mbu,
                        evaluation.testvideos[findelement].id,
                        file.mimetype.split('/')[1],
                        `${id}_TEST_STREAM_${req.params.question}`
                      ),
                    });
                    evaluation.testvideos.splice(findelement, 1);
                    await evaluation.save();
                    await promises.unlink(`stream_${ddd}.webm`);
                    await promises.unlink(`textfile_${ddd}.txt`);
                    await promises.unlink(`stream_${dd}.webm`);
                    await promises.unlink(`stream_${d}.webm`);
                    return res.json({ message: 'Stream saved successfully' });
                  } catch (error) {
                    return res
                      .status(400)
                      .json({ error: 'Cannot save stream' });
                  }
                });
              ff.run();
            }
          }
        } catch (error) {
          return res.status(400).json({ error: 'Cannot save stream' });
        }
      });
    ff.run();
  } catch (error) {
    return res.status(400).json({ error: 'Cannot save stream' });
  }
};

const showresult = async (req: Request, res: Response) => {
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
      evaluation.userid.toString() !== req.token.id
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
      ischeated: evaluation.cheated === undefined ? [] : evaluation.cheated,
    });
  } catch (error) {
    return res.status(400).json({ error: 'Evaluation not found' });
  }
};

const examinee_event = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    establishConnection(res, 3000);
    await tokenCheck(req, res, next);
    if (req.token === undefined) {
      return;
    }
    const id = req.token.id;
    let time: Array<number> = [];
    let not = 0;
    const examineeeventInterval = setInterval(async () => {
      if (req.token === undefined) {
        return;
      }
      const id = req.token.id;
      const examinee = await Examinee.findOne({
        type: 'EXAMINEE',
        _id: id,
      });
      if (examinee === null) {
        return res.sse({
          data: 'user not found',
          event: 'ERROR',
        });
      }
      const tests = await Test.find({
        $or: [{ starttest: true }, { endtest: true }],
      });
      if (tests.length !== 0) {
        const test = tests.find((t) =>
          t.activeexamineelist.find((e) => e.id.toString() === id)
        );
        if (test !== undefined) {
          const e = test.activeexamineelist.find((e) => e.id.toString() === id);
          if (e !== undefined && test.endtest === true) {
            res.sse({
              data: { status: 'TIMER', time: 'END TEST' },
              event: 'EXAMINEE',
            });
            const ev = await Evaluation.findOne({
              userid: examinee._id,
              testid: test._id,
            });
            if (ev !== null && ev.isended !== true) {
              test.activeexamineelist.splice(
                test.activeexamineelist.indexOf(e),
                1
              );
              examinee.testcode = undefined;
              await examinee.save();
              await test.save();
            }
          } else if (e !== undefined) {
            if (e.time[0] === 0 && e.time[1] === 0 && e.time[2] === 0) {
              res.sse({
                data: { status: 'TIMER', time: 'END TEST' },
                event: 'EXAMINEE',
              });
              const ev = await Evaluation.findOne({
                userid: examinee._id,
                testid: test._id,
              });
              if (ev !== null && ev.isended !== true) {
                test.activeexamineelist.splice(
                  test.activeexamineelist.indexOf(e),
                  1
                );
                examinee.testcode = undefined;
                await examinee.save();
                await test.save();
              }
            }
            if (time.length === 0) {
              time = e.time;
            }
            if (time[2] !== 0) {
              time[2] -= 1;
            } else if (time[2] === 0) {
              if (time[1] !== 0) {
                time[1] -= 1;
                time[2] = 59;
              } else if (time[0] !== 0) {
                time[0] -= 1;
                time[1] = 59;
                time[2] = 59;
              }
            }
            res.sse({
              data: { status: 'TIMER', time: time },
              event: 'EXAMINEE',
            });
            not += 1;
            if (not === 5) {
              not = 0;
              e.time = time;
              test.activeexamineelist.splice(
                test.activeexamineelist.findIndex(
                  (e) => e.id.toString() === id
                ),
                1,
                e
              );
              await test.save();
            }
          }
        }
      }
    }, 1000);

    res.on('finish', () => clearInterval(examineeeventInterval));
    res.on('close', async () => {
      clearInterval(examineeeventInterval);
      const tests = await Test.find({
        $or: [{ starttest: true }, { endtest: true }],
      });
      if (tests.length !== 0) {
        const nvtest = tests.find((t) =>
          t.notverifiedexamineelist.find((e) => e.id.toString() === id)
        );
        const atest = tests.find((t) =>
          t.activeexamineelist.find((e) => e.id.toString() === id)
        );
        if (nvtest) {
          const list = [];
          type inactivetype = {
            id: Types.ObjectId;
            time: number[];
            isverified: boolean;
          };
          let inactive: inactivetype = {} as inactivetype;
          for (let i = 0; i < nvtest.notverifiedexamineelist.length; i++) {
            const element = nvtest.notverifiedexamineelist[i];
            if (element.id.toString() === id) {
              inactive = element;
              continue;
            }
            list.push(element);
          }
          nvtest.notverifiedexamineelist = list;
          nvtest.inactiveexamineelist.push(inactive);
          await nvtest.save();
        } else if (atest) {
          const list = [];
          type inactivetype = {
            id: Types.ObjectId;
            time: number[];
            isverified: boolean;
          };
          let inactive: inactivetype = {} as inactivetype;
          for (let i = 0; i < atest.activeexamineelist.length; i++) {
            const element = atest.activeexamineelist[i];
            if (element.id.toString() === id) {
              inactive = element;
              inactive.time = time;
              continue;
            }
            list.push(element);
          }
          atest.activeexamineelist = list;
          atest.inactiveexamineelist.push(inactive);
          await atest.save();
        }
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
    const examinee = await Examinee.findById(req.token.id);
    if (examinee === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const encname = Encrypt(req.body.name);
    examinee.name = Buffer.concat([encname[2], encname[0], encname[1]]);
    await examinee.save();
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
    const examinee = await Examinee.findById(req.token.id);
    if (examinee === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    return res.status(200).json({
      commid: Decrypt(
        examinee.comid.subarray(0, 32),
        examinee.comid.subarray(examinee.comid.length - 16),
        examinee.comid.subarray(32, examinee.comid.length - 16)
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
    const examinee = await Examinee.findById(req.token.id);
    if (examinee === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const enccommid = Encrypt(req.body.commid);
    examinee.change = {
      commid: Buffer.concat([enccommid[2], enccommid[0], enccommid[1]]),
    };
    const code = randomBytes(256).toString('base64url');
    const dd = new Date();
    examinee.verification = await hash(code, 10);
    examinee.DeleteAccountChangeAfter = new Date(dd.getTime() + 60 * 60000);
    await examinee.save();
    await sendcom(
      Decrypt(
        examinee.comid.subarray(0, 32),
        examinee.comid.subarray(examinee.comid.length - 16),
        examinee.comid.subarray(32, examinee.comid.length - 16)
      ).toString(),
      'Changing communication Id',
      {
        logo: `${process.env.serverurl}public/logo/`,
        name: Decrypt(
          examinee.name.subarray(0, 32),
          examinee.name.subarray(examinee.name.length - 16),
          examinee.name.subarray(32, examinee.name.length - 16)
        ).toString(),
        requestlink: `${process.env.client}#/verification/${code}/${examinee._id}`,
        securelink: `${process.env.client}#/secure/${code}/${examinee._id}`,
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
    const examinee = await Examinee.findById(req.token.id);
    if (examinee === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const tmpcom = await compare(req.body.currentpassword, examinee.password);
    if (tmpcom && req.body.currentpassword !== req.body.newpassword) {
      const encpassword = await hash(req.body.newpassword, 13);
      examinee.change = {
        password: encpassword,
      };
      const code = randomBytes(256).toString('base64url');
      const dd = new Date();
      examinee.verification = await hash(code, 10);
      examinee.DeleteAccountChangeAfter = new Date(dd.getTime() + 60 * 60000);
      await examinee.save();
      await sendcom(
        Decrypt(
          examinee.comid.subarray(0, 32),
          examinee.comid.subarray(examinee.comid.length - 16),
          examinee.comid.subarray(32, examinee.comid.length - 16)
        ).toString(),
        'Changing password',
        {
          logo: `${process.env.serverurl}public/logo/`,
          name: Decrypt(
            examinee.name.subarray(0, 32),
            examinee.name.subarray(examinee.name.length - 16),
            examinee.name.subarray(32, examinee.name.length - 16)
          ).toString(),
          requestlink: `${process.env.client}#/verification/${code}/${examinee._id}`,
          securelink: `${process.env.client}#/secure/${code}/${examinee._id}`,
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
  startexam,
  examverificationimages,
  submitanswers,
  skipanswers,
  endtest,
  cheating,
  endstream,
  savestream,
  showresult,
  examinee_event,
  account_commid,
  account_getcomm,
  account_name,
  account_password,
};
