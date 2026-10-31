// Matrizes originais extraídas de Client/animation/0000.lab (Lance).
// Cada matriz LAB está salva na ordem de floats DirectX (vetores-linha).
// THREE.Matrix4.fromArray() interpreta como column-major, transpondo
// corretamente a convenção DirectX sem alterar eixos do esqueleto.
// Não se trata de valores ajustados manualmente no editor.
export const LANCE_LAB_DUMMIES={
  "6": {
    "parent": 18,
    "matrix": [
      0.9982363,
      0.05620915,
      0.01910075,
      0,
      -0.05618867,
      0.9984194,
      -0.00160672,
      0,
      -0.01916079,
      0.00053061,
      0.99981672,
      0,
      0.50232589,
      0.01135902,
      0.96584833,
      1
    ]
  },
  "9": {
    "parent": 26,
    "matrix": [
      0.99967986,
      -0.02409853,
      0.00768523,
      0,
      0.02432752,
      0.9992159,
      -0.03123274,
      0,
      -0.00692609,
      0.03140946,
      0.99948239,
      0,
      -0.4394145,
      -0.05683735,
      0.96383542,
      1
    ]
  },
  "21": {
    "parent": 4,
    "matrix": [
      0.02502942,
      0.98517823,
      -0.16969682,
      0,
      -0.72965103,
      -0.09803353,
      -0.67675608,
      0,
      -0.68336207,
      0.14075826,
      0.71638256,
      0,
      0.02235863,
      -0.21771061,
      1.50150597,
      1
    ]
  },
  "22": {
    "parent": 4,
    "matrix": [
      0.05940668,
      0.98517841,
      -0.160917,
      0,
      -0.57480872,
      -0.09803354,
      -0.81239402,
      0,
      -0.81612808,
      0.14075825,
      0.5604651,
      0,
      0.02468445,
      -0.29033396,
      1.63605857,
      1
    ]
  },
  "23": {
    "parent": 36,
    "matrix": [
      0.96878743,
      0.13246761,
      -0.20953208,
      0,
      -0.2104779,
      -0.0069801,
      -0.97757316,
      0,
      -0.13095938,
      0.99116266,
      0.02111928,
      0,
      -0.28286985,
      -0.00688829,
      1.10460794,
      1
    ]
  }
};

export function historicalWeaponDummies(actor,job,slot){
  if(actor!=='lance'||job!=='crusader'||(slot!==6&&slot!==9))return null;
  const hand=LANCE_LAB_DUMMIES[slot];
  const back=LANCE_LAB_DUMMIES[slot===6?22:21];
  return hand&&back?{hand,back,slot}:null;
}
