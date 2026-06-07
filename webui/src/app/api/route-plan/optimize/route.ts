import { NextResponse } from 'next/server';
import { buildMockRoutePlanResponse } from '@/lib/routePlanMock';

export async function POST() {
  return NextResponse.json(buildMockRoutePlanResponse());
}
