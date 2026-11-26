import { rewrite } from '@vercel/functions';

export const config = {
  matcher: '/',
};

const VARIANT_COOKIE = 'vsl_variant';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export default function middleware(request: Request) {
  const abEnabled = process.env.VSL_AB_ENABLED !== 'false';

  const cookieHeader = request.headers.get('cookie') ?? '';
  const existing = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${VARIANT_COOKIE}=`));
  const existingVariant = existing?.split('=')[1];

  let variant: 'old' | 'new';
  if (!abEnabled) {
    variant = 'old';
  } else if (existingVariant === 'old' || existingVariant === 'new') {
    variant = existingVariant;
  } else {
    variant = Math.random() < 0.5 ? 'old' : 'new';
  }

  const target = variant === 'new' ? '/variation-a-new' : '/variation-a';
  const url = new URL(target, request.url);
  const response = rewrite(url);

  response.headers.append(
    'set-cookie',
    `${VARIANT_COOKIE}=${variant}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
  );
  response.headers.append(
    'set-cookie',
    `ab_variant=a; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
  );

  return response;
}
