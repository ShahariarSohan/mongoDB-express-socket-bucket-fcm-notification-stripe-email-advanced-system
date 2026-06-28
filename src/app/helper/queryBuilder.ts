interface QueryOptions {
  model: any;
  query: any;
  searchableFields?: string[];
  forcedFilters?: Record<string, any>; // 👈 new
  includes?: Record<string, any>;
  role?: string;
}

export const dynamicQueryBuilder = async ({
  model,
  query,
  searchableFields = [],
  forcedFilters = {},
  includes = {},
}: QueryOptions) => {
  const {
    page = 1,
    limit = 10,
    search,
    sortBy = "createdAt",
    order = "desc",

    ...filters
  } = query;

  const numericLimit = parseInt(limit as string, 10);
  const numericPage = parseInt(page as string, 10);
  const skip = (numericPage - 1) * numericLimit;

  const searchCondition =
    search && searchableFields.length > 0
      ? {
          OR: searchableFields.map((field) => {
            const keys = field.includes(".") ? field.split(".") : [field];
            const value = {
              contains: search,
              mode: "insensitive",
            };

            // @ts-ignore
            return keys.reduceRight((acc, key) => ({ [key]: acc }), value);
          }),
        }
      : {};

  const { ...restFilters } = filters;

  const relationFilter: any[] = [];

  // if any relation filters are present then have to add manually (Applicable if includes the relations)
  // if (sportName)
  //   relationFilter.push(
  //     {
  //       AthleteInfo: { sportName: { equals: sportName, mode: "insensitive" } },
  //     },
  //     { ClubInfo: { sportName: { equals: sportName, mode: "insensitive" } } }
  //   );

  const filterConditions = {
    ...restFilters,
    ...forcedFilters, // ✅ override or enforce protected filters like userId
  };

  const where = {
    ...searchCondition,
    ...filterConditions,
    ...(relationFilter.length > 0 ? { OR: relationFilter } : {}),
  };

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      skip,
      take: numericLimit,
      orderBy: {
        [sortBy]: order,
      },
      include: includes || {}, // 👈 include relations if specified
    }),
    model.count({ where }),
  ]);

  const totalPages = Math.ceil(total / numericLimit);

  return {
    meta: {
      currentPage: numericPage,
      totalPages,
      totalItems: total,
      perPage: numericLimit,
    },
    data,
  };
};
/**
 * Build where clause for Prisma queries with search and filters
 */
export const buildWhereClause = (
  searchTerm: string | undefined,
  searchableFields: string[],
  filters: Record<string, any>
) => {
  const whereConditions: any = {};

  // Reserved parameters that should not be used as filters
  const reservedParams = ['lang', 'language', 'page', 'limit', 'sortBy', 'sortOrder', 'searchTerm'];

  // Search term conditions
  if (searchTerm) {
    whereConditions.OR = searchableFields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: "insensitive",
      },
    }));
  }

  // Apply filters (excluding reserved parameters)
  Object.keys(filters).forEach((key) => {
    // Skip reserved parameters
    if (reservedParams.includes(key)) {
      return;
    }
    
    if (filters[key] !== undefined && filters[key] !== "") {
      // Handle enum values
      if (key === "role" || key === "status") {
        whereConditions[key] = filters[key];
      }
      // Handle boolean values
      else if (key === "isVerified" || key === "isRedeemed") {
        whereConditions[key] = filters[key] === "true" || filters[key] === true;
      }
      // Handle other filters
      else {
        whereConditions[key] = filters[key];
      }
    }
  });

  return whereConditions;
};