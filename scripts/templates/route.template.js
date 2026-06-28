
module.exports = ({ pascal, camel }) => `import express from 'express';
import auth from '../../middleware/auth';
import { Role } from '@prisma/client';
import { ${pascal}Controllers } from './${camel}.controller';

const router = express.Router();

router.post('/', auth(Role.ADMIN, Role.SUPER_ADMIN), ${pascal}Controllers.create${pascal});
router.get('/', ${pascal}Controllers.getAll${pascal}s);
router.get('/:id', ${pascal}Controllers.getSingle${pascal});
router.patch('/:id', auth(Role.ADMIN, Role.SUPER_ADMIN), ${pascal}Controllers.update${pascal});
router.delete('/:id', auth(Role.ADMIN, Role.SUPER_ADMIN), ${pascal}Controllers.delete${pascal});

export const ${pascal}Routes = router;
`
