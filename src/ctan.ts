import { HttpClient, HttpCodes } from '@actions/http-client';

let http: HttpClient | undefined;

export interface Pkg {
  version?: {
    number?: string;
  };
  texlive?: string;
}

export async function pkg(name: string): Promise<Pkg> {
  http ??= new HttpClient();
  const endpoint = `https://ctan.org/json/2.0/pkg/${name}`;
  const { result, statusCode } = await http.getJson<Pkg>(endpoint);
  if (statusCode === HttpCodes.NotFound) {
    throw new Error(`${endpoint} returned ${HttpCodes.NotFound}`);
  }
  return result ?? {};
}
