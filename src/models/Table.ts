import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Floor } from "./Floor";
import { Reservation } from "./Reservation";

export enum TableShape {
  RECTANGLE = "RECTANGLE",
  CIRCLE = "CIRCLE",
  SQUARE = "SQUARE",
}

@Table({ tableName: "tables" })
export class TableModel extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.STRING)
  declare label: string;

  @Default(TableShape.RECTANGLE)
  @Column(DataType.ENUM(...Object.values(TableShape)))
  declare shape: TableShape;

  @Column(DataType.FLOAT)
  declare x: number;

  @Column(DataType.FLOAT)
  declare y: number;

  @Default(80)
  @Column(DataType.FLOAT)
  declare width: number;

  @Default(80)
  @Column(DataType.FLOAT)
  declare height: number;

  @Default(0)
  @Column(DataType.FLOAT)
  declare rotation: number;

  @Column(DataType.INTEGER)
  declare capacity: number;

  @Default(1)
  @Column(DataType.INTEGER)
  declare minCapacity: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isWindowSeat: boolean;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @Column(DataType.TEXT)
  declare notes: string | null;

  @ForeignKey(() => Floor)
  @Column(DataType.UUID)
  declare floorId: string;

  @BelongsTo(() => Floor)
  declare floor: Floor;

  @HasMany(() => Reservation)
  declare reservations: Reservation[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
