// How far this device's clock is from the server's (from the play
// function's answers), so live games like /crash show the server's timing.
let skew = 0;
export const setServerSkew = (serverNow) => {
  if (serverNow) skew = serverNow - Date.now();
};
export const serverNow = () => Date.now() + skew;
