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
import { Router } from 'express';
import { body, param } from 'express-validator';

import {
  account_commid,
  account_getcomm,
  account_name,
  account_password,
  examinee_event,
  endtest,
  examverificationimages,
  startexam,
  submitanswers,
  skipanswers,
  endstream,
  savestream,
  showresult,
  cheating,
} from '../../controllers/api/examineeController';
import { tokenCheck } from '../../middlewares/tokenVerifier';

const ExamineeRouter = Router();

ExamineeRouter.post(
  '/startexam',
  tokenCheck,
  body('examid').not().isEmpty().isAlphanumeric().trim().escape(),
  body('code').not().isEmpty().isNumeric().trim().escape(),
  startexam
);

ExamineeRouter.post(
  '/verificationimages',
  tokenCheck,
  body('examid').not().isEmpty().isAlphanumeric().trim().escape(),
  examverificationimages
);

ExamineeRouter.post(
  '/submitanswer',
  tokenCheck,
  body('index').not().isEmpty().isNumeric().trim().escape(),
  body('examid').not().isEmpty().isAlphanumeric().trim().escape(),
  body('answer')
    .not()
    .isEmpty()
    .if(body('answer').not().isEmpty().isString())
    .isString()
    .trim()
    .escape(),
  body('answer')
    .not()
    .isEmpty()
    .if(body('answer').not().isEmpty().isArray({ min: 1 }))
    .isArray({ min: 1 }),
  submitanswers
);

ExamineeRouter.post(
  '/skipanswer',
  tokenCheck,
  body('index').not().isEmpty().isNumeric().trim().escape(),
  body('examid').not().isEmpty().isAlphanumeric().trim().escape(),
  skipanswers
);

ExamineeRouter.post(
  '/cheating',
  tokenCheck,
  body('reason').not().isEmpty().trim().escape(),
  body('examid').not().isEmpty().isAlphanumeric().trim().escape(),
  cheating
);

ExamineeRouter.get(
  '/end_test/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  endtest
);

ExamineeRouter.post(
  '/end_stream/:question',
  tokenCheck,
  body('examid').not().isEmpty().isAlphanumeric().trim().escape(),
  param('question').not().isEmpty().isNumeric().trim().escape(),
  endstream
);

ExamineeRouter.post(
  '/save_stream/:question',
  tokenCheck,
  body('examid').not().isEmpty().isAlphanumeric().trim().escape(),
  param('question').not().isEmpty().isNumeric().trim().escape(),
  savestream
);

ExamineeRouter.get(
  '/showresult/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  showresult
);

ExamineeRouter.get(
  '/examinee-event/:token',
  examinee_event
);

ExamineeRouter.post(
  '/account_name',
  tokenCheck,
  body('name').not().isEmpty().trim().escape(),
  account_name
);

ExamineeRouter.get(
  '/account_getcomm',
  tokenCheck,
  account_getcomm
);

ExamineeRouter.post(
  '/account_commid',
  tokenCheck,
  body('commtype')
    .not()
    .isEmpty()
    .isAlpha()
    .custom((value) => {
      if (value === 'EMAIL') {
        return true;
      } else {
        return false;
      }
    }),
  body('commid')
    .if(
      body('commtype').custom((value: string) => {
        if (value === 'EMAIL') {
          return true;
        } else {
          return false;
        }
      })
    )
    .not()
    .isEmpty()
    .isEmail()
    .normalizeEmail(),
  account_commid
);

ExamineeRouter.post(
  '/account_password',
  tokenCheck,
  body('currentpassword')
    .not()
    .isEmpty()
    .trim()
    .custom((value) => {
      const re =
        /^(?=.*\d)(?=.*[-!@#$%^&*()_+|~=`{}\[\]:";'<>?,.\/])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
      if (re.test(value)) {
        return true;
      } else {
        return false;
      }
    }),
  body('newpassword')
    .not()
    .isEmpty()
    .trim()
    .custom((value) => {
      const re =
        /^(?=.*\d)(?=.*[-!@#$%^&*()_+|~=`{}\[\]:";'<>?,.\/])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
      if (re.test(value)) {
        return true;
      } else {
        return false;
      }
    }),
  body('confirmpassword')
    .not()
    .isEmpty()
    .trim()
    .isLength({ min: 8 })
    .custom((value, { req }) => {
      if (value === req.body.newpassword) {
        return true;
      } else {
        return false;
      }
    }),
  account_password
);

export { ExamineeRouter };
