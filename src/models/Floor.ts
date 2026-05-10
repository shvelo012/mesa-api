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
import { Restaurant } from "./Restaurant";
import { TableModel } from "./Table";
import { Wall } from "./Wall";

export enum SectionType {
  INDOOR = "INDOOR",
  OUTDOOR = "OUTDOOR",
  BAR = "BAR",
  PRIVATE = "PRIVATE",
}

@Table({ tableName: "floors" })
export class Floor extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.STRING)
  declare name: string;

  @Default(SectionType.INDOOR)
  @Column(DataType.ENUM(...Object.values(SectionType)))
  declare sectionType: SectionType;

  @Default(800)
  @Column(DataType.FLOAT)
  declare width: number;

  @Default(600)
  @Column(DataType.FLOAT)
  declare height: number;

  @Default("#f5f5f0")
  @Column(DataType.STRING)
  declare bgColor: string;

  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @HasMany(() => TableModel)
  declare tables: TableModel[];

  @HasMany(() => Wall)
  declare walls: Wall[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
