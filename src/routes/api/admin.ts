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
  mark_notification,
  notification,
  notification_details,
  unmark_notification,
  delete_notification,
  examinees,
  examinees_details,
  verify_examinee,
  disprove_examinee,
  delete_examinee,
  moderators,
  moderators_details,
  verify_moderator,
  disprove_moderator,
  delete_moderator,
  admin_event,
  examinee_images,
  moderator_images,
  account_name,
  account_getcomm,
  account_commid,
  account_password,
} from '../../controllers/api/adminController';
import { tokenCheck } from '../../middlewares/tokenVerifier';

const AdminRouter = Router();

AdminRouter.get(
  '/notification',
  tokenCheck,
  notification
);

AdminRouter.get(
  '/notification_details/:ids',
  tokenCheck,
  param('ids').not().isEmpty().isJSON(),
  notification_details
);

AdminRouter.get(
  '/mark_notification/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim(),
  mark_notification
);

AdminRouter.get(
  '/unmark_notification/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  unmark_notification
);

AdminRouter.delete(
  '/delete_notification/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  delete_notification
);

AdminRouter.get('/examinees', tokenCheck,  examinees);

AdminRouter.get(
  '/examinees_details/:status/:ids',
  tokenCheck,
  param('ids').not().isEmpty().isJSON(),
  param('status')
    .not()
    .isEmpty()
    .trim()
    .escape()
    .custom((value) => {
      if (value === 'Pending Verification' || value === 'Verified') {
        return true;
      } else {
        return false;
      }
    }),
  examinees_details
);

AdminRouter.get(
  '/examinee_images/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  examinee_images
);

AdminRouter.get(
  '/verify_examinee/:id',
  tokenCheck,
  param('id').not().isEmpty().trim().escape().isAlphanumeric(),
  verify_examinee
);

AdminRouter.post(
  '/disprove_examinee/:id',
  tokenCheck,
  param('id').not().isEmpty().trim().escape().isAlphanumeric(),
  body('reason').not().isEmpty().trim().escape(),
  body('type').not().isEmpty().trim().escape().isNumeric(),
  disprove_examinee
);

AdminRouter.delete(
  '/delete_examinee/:id',
  tokenCheck,
  param('id').not().isEmpty().trim().escape().isAlphanumeric(),
  delete_examinee
);

AdminRouter.get(
  '/moderators',
  tokenCheck,
  moderators
);

AdminRouter.get(
  '/moderators_details/:status/:ids',
  tokenCheck,
  param('ids').not().isEmpty().isJSON(),
  param('status')
    .not()
    .isEmpty()
    .trim()
    .escape()
    .custom((value) => {
      if (value === 'Pending Verification' || value === 'Verified') {
        return true;
      }
      return false;
    }),
  moderators_details
);

AdminRouter.get(
  '/moderator_images/:id',
  tokenCheck,
  param('id').not().isEmpty().isAlphanumeric().trim().escape(),
  moderator_images
);

AdminRouter.get(
  '/verify_moderator/:id',
  tokenCheck,
  param('id').not().isEmpty().trim().escape().isAlphanumeric(),
  verify_moderator
);

AdminRouter.post(
  '/disprove_moderator/:id',
  tokenCheck,
  param('id').not().isEmpty().trim().escape().isAlphanumeric(),
  body('reason').not().isEmpty().trim().escape(),
  body('type').not().isEmpty().trim().escape().isNumeric(),
  disprove_moderator
);

AdminRouter.delete(
  '/delete_moderator/:id',
  tokenCheck,
  param('id').not().isEmpty().trim().escape().isAlphanumeric(),
  delete_moderator
);

AdminRouter.get('/admin-event/:token',  admin_event);

AdminRouter.post(
  '/account_name',
  tokenCheck,
  body('name').not().isEmpty().trim().escape(),
  account_name
);

AdminRouter.get(
  '/account_getcomm',
  tokenCheck,
  account_getcomm
);

AdminRouter.post(
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

AdminRouter.post(
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

export { AdminRouter };
