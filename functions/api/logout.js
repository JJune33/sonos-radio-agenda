import {checkOrigin,clearCookie,json} from '../_lib/core.js';
export function onRequestPost({request}){const origin=checkOrigin(request);if(origin)return origin;return json({ok:true},200,{'Set-Cookie':clearCookie})}
