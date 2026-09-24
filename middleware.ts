import { rewrite } from '@vercel/functions';

export const config = {
  matcher: '/',
};

export default function middleware(request: Request) {
  const url = new URL('/variation-a', request.url);
  const response = rewrite(url);
  response.headers.append(
    'set-cookie',
    `ab_variant=a; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
  );
  return response;
}
