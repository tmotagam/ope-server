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
import { param, body } from 'express-validator';

import {
  mark_notification,
  notification,
  notification_details,
  unmark_notification,
  delete_notification,
  add_test,
  tests,
  tests_detail,
  test_detail,
  delete_test,
  moderator_event,
  searchExaminees,
  account_name,
  account_getcomm,
  account_commid,
  account_password,
  evaluations,
  evaluations_details,
  done_evaluation_details,
  pending_evaluation_details,
  eval_Examinee_cheated,
  eval_Video_Data,
  eval_answer_evaluation,
  eval_completed,
  eval_answer_reevaluation,
} from '../../controllers/api/moderatorController';
import { tokenCheck } from '../../middlewares/tokenVerifier';

const ModeratorRouter = Router();

ModeratorRouter.get(
  '/notification',
  tokenCheck,
  notification
);

ModeratorRouter.get(
  '/searchexaminees',
  tokenCheck,
  searchExaminees
);

ModeratorRouter.get(
  '/notification_details/:ids',
  tokenCheck,
  param('ids').not().isEmpty().isJSON(),
  notification_details
);

ModeratorRouter.get(
  '/mark_notification/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  mark_notification
);

ModeratorRouter.get(
  '/unmark_notification/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  unmark_notification
);

ModeratorRouter.delete(
  '/delete_notification/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  delete_notification
);

ModeratorRouter.post(
  '/add_test',
  tokenCheck,
  body('name').not().isEmpty().isString().trim().escape(),
  body('time').not().isEmpty().trim().escape(),
  body('examlist').not().isEmpty().isJSON(),
  body('windowstart')
    .not()
    .isEmpty()
    .custom((value) => {
      if (new Date(value).toString() === 'Invalid Date') {
        return false;
      } else {
        return true;
      }
    }),
  body('windowend')
    .not()
    .isEmpty()
    .custom((value) => {
      if (new Date(value).toString() === 'Invalid Date') {
        return false;
      } else {
        return true;
      }
    }),
  add_test
);

ModeratorRouter.get('/tests', tokenCheck,  tests);

ModeratorRouter.get(
  '/tests_detail/:ids',
  tokenCheck,
  param('ids').not().isEmpty().isJSON(),
  tests_detail
);

ModeratorRouter.get(
  '/test_detail/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  test_detail
);

ModeratorRouter.delete(
  '/delete_test/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  delete_test
);

ModeratorRouter.get(
  '/evaluations',
  tokenCheck,
  evaluations
);

ModeratorRouter.get(
  '/evaluations_details/:status/:ids',
  tokenCheck,
  param('ids').not().isEmpty().isJSON(),
  param('status').not().isEmpty().trim().escape().isBoolean(),
  evaluations_details
);

ModeratorRouter.get(
  '/done_evaluation_detail/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  done_evaluation_details
);

ModeratorRouter.get(
  '/pending_evaluation_detail/:id/:stage',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  param('stage').not().isEmpty().isNumeric().trim().escape(),
  pending_evaluation_details
);

ModeratorRouter.post(
  '/eval_examinee_cheated/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  body('reason').not().isEmpty().trim().escape(),
  eval_Examinee_cheated
);

ModeratorRouter.get(
  '/eval_video_data/:id/:index',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  param('index').not().isEmpty().isNumeric().trim().escape(),
  eval_Video_Data
);

ModeratorRouter.post(
  '/eval_answer_evaluation',
  tokenCheck,
  body('id').not().isEmpty().isAlphanumeric().trim().escape(),
  body('index').not().isEmpty().isNumeric().trim().escape(),
  body('iscorrect').not().isEmpty().isBoolean().trim().escape(),
  eval_answer_evaluation
);

ModeratorRouter.get(
  '/eval_completed/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  eval_completed
);

ModeratorRouter.post(
  '/eval_answer_reevaluation',
  tokenCheck,
  body('id').not().isEmpty().isAlphanumeric().trim().escape(),
  body('index').not().isEmpty().isNumeric().trim().escape(),
  body('iscorrect').not().isEmpty().isBoolean().trim().escape(),
  eval_answer_reevaluation
);

ModeratorRouter.get(
  '/moderator-event/:token',
  moderator_event
);

ModeratorRouter.post(
  '/account_name',
  tokenCheck,
  body('name').not().isEmpty().trim().escape(),
  account_name
);

ModeratorRouter.get(
  '/account_getcomm',
  tokenCheck,
  account_getcomm
);

ModeratorRouter.post(
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

ModeratorRouter.post(
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

export { ModeratorRouter };
