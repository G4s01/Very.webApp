import React, { useState } from "react";

type Props = {
  total: number;
  regular: number;
  promo: number;
};

export default function CreditButton({ total, regular, promo }: Props) {
  const [hover, setHover] = useState(false);

  return (
    <button
      className={`credit-btn${hover ? " open" : ""}`}
      type="button"
      aria-label={
        hover
          ? `Credito: ${regular.toFixed(2)}€ + ${promo.toFixed(2)}€`
          : `Credito totale: ${total.toFixed(2)}€`
      }
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{ marginLeft: 12 }}
    >
      {!hover ? (
        <span className="credit-main">
          {total.toFixed(2)} <span className="euro">€</span>
        </span>
      ) : (
        <span className="credit-double">
          <span className="credit-cell credit-non-promo">
            {regular.toFixed(2)} <span className="euro">€</span>
          </span>
          <span className="credit-sep">+</span>
          <span className="credit-cell credit-promo">
            {promo.toFixed(2)} <span className="euro">€</span>
          </span>
        </span>
      )}

      <style jsx>{`
        .credit-btn {
          border-radius: 12px;
          background: linear-gradient(180deg,#f3fff7 0%, #eefff8 100%);
          border: 1.5px solid #b7e2cd;
          box-shadow: 0 2px 16px rgba(38,70,83,0.05);
          font-size: 1.06rem;
          font-weight: 700;
          color: #0a5d36;
          padding: 10px 16px;
          transition: border-color 0.16s, box-shadow 0.16s;
          cursor: pointer;
          outline: none;
          min-width: 87px;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
          border-bottom: 2.5px solid #e5f9ef;
        }
        .credit-btn:focus-visible {
          border-color: #57c899;
          box-shadow: 0 0 0 3px #bff6db;
        }
        .credit-main {
          font-size: 1.08rem;
          color: #0a5d36;
        }
        .credit-double {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .credit-cell {
          padding: 0 4px;
          border-radius: 9px;
          background: #fff;
          color: #249169;
          font-size: 0.97rem;
          border: 1.1px solid #d1ede0;
        }
        .credit-non-promo {
          font-weight: 700;
          background: #f7fffa;
        }
        .credit-promo {
          font-weight: 600;
          color: #398a6a;
          background: #f0ffe7;
        }
        .credit-sep {
          font-size: 1.2rem;
          color: #54cab1;
          font-weight: bold;
          margin: 0 1px;
          user-select: none;
        }
        .euro { font-size:0.97em; opacity:0.75; margin-left:2px;}
      `}</style>
    </button>
  );
}