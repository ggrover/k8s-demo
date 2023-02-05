import { Token } from 'cdktf';

export const idToken = ({ id }: { id: string }) => Token.asString(id);

export const idTokenList = (items: { id: string }[]) => Token.asList(items.map(({ id }) => id));
