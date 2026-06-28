module.exports = ({
  pascal,
  camel,
}) => `import { ${pascal} } from "@prisma/client";
import { prisma } from "../../../utils/prisma";
import ApiError from "../../error/ApiErrors"

const create${pascal} = async (payload: ${pascal}) => {
  const ${camel} = await prisma.${camel}.create({
    data: payload,
  });
  return ${camel};
};

const getAll${pascal}s = async (query: any) => {
  const { page = 1, limit = 10 } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const whereConditions: any = {};

  const totalCount = await prisma.${camel}.count({
    where: whereConditions,
  });

  const ${camel}s = await prisma.${camel}.findMany({
    where: whereConditions,
    skip,
    take,
  });

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      totalCount,
      totalPages: Math.ceil(totalCount / Number(limit)),
    },
    data: ${camel}s,
  };
};

const getSingle${pascal} = async (id: string) => {
  const ${camel} = await prisma.${camel}.findUnique({
    where: {
      id,
    },
  });

  if (!${camel}) {
    throw new ApiError(400, "${pascal} not found");
  }

  return ${camel};
};

const update${pascal} = async (id: string, payload: Partial<${pascal}>) => {
  const ${camel} = await prisma.${camel}.update({
    where: {
      id,
    },
    data: payload,
  });

  return ${camel};
};

const delete${pascal} = async (id: string) => {
  const ${camel} = await prisma.${camel}.findUnique({
    where: {
      id,
    },
  });

  if (!${camel}) {
    throw new ApiError(400, "${pascal} not found");
  }

  await prisma.${camel}.delete({
    where: {
      id,
    },
  });

  return ${camel};
};

export const ${pascal}Services = {
  create${pascal},
  getAll${pascal}s,
  getSingle${pascal},
  update${pascal},
  delete${pascal},
};`
